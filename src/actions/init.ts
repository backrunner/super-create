import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { UNNECESSARY_PACKAGE_PROPERTIES } from '../constants';
import { ERRORS } from '../constants/errors';
import { GIT_REPO_URL_CHECKER } from '../utils/regex';
import { UserProjectInfo } from '../types';
import { LicenseIds } from '../utils/license';
import { execAsync } from '../utils/exec';

const getUserProjectInfo = async () => {
  console.log(chalk.cyan('Firstly, you need to provide some necessary information to initialize your new project:\n'));
  const userProjectInfo: UserProjectInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project Name: ',
      validate: (v) => {
        if (!v) {
          return 'Project name should not be empty.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'desc',
      message: 'Description: ',
      default: '',
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version: ',
      default: '0.0.1',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author: ',
      default: '',
    },
    {
      type: 'input',
      name: 'license',
      message: 'License (empty means no license): ',
      default: '',
      validate: (v) => {
        if (!v) {
          return true;
        }
        return LicenseIds.includes(v.toLowerCase())
          ? true
          : 'Invalid license ID (the license name should in the SPDX License List).\nSee https://spdx.org/licenses/ for more details.';
      },
    },
  ]);
  return userProjectInfo;
};

const checkUserProjectEnv = async (userProjectInfo: UserProjectInfo) => {
  process.stdout.write(chalk.cyan('\nChecking current environment...'));
  const userProjectPath = path.resolve(process.cwd(), `./${userProjectInfo.name}`);
  if (!fs.existsSync(userProjectPath)) {
    await fsp.mkdir(userProjectPath, { recursive: true });
    process.stdout.write(chalk.green('\t\t\t✔\n'));
    return;
  }
  const stat = await fsp.stat(userProjectPath);
  if (!stat.isDirectory()) {
    await fsp.mkdir(userProjectPath, { recursive: true });
    process.stdout.write(chalk.green('\t\t\t✔\n'));
    return;
  }
  // folder existed
  const confirm = await inquirer.prompt({
    type: 'confirm',
    name: 'v',
    message: `Folder named "${userProjectInfo.name}" was existed, do you want to continue creating a new project with same name?`,
    default: false,
  });
  if (!confirm.v) {
    process.stdout.write(chalk.red('\t\t\t✘\n'));
    return process.exit(0);
  }
  const delConfirm = await inquirer.prompt({
    type: 'confirm',
    name: 'v',
    message: 'WARNING: To continue creating, the existed folder will be removed, please confirm.',
    default: false,
  });
  if (!delConfirm.v) {
    process.stdout.write(chalk.red('\t\t\t✘\n'));
    return process.exit(0);
  }
  await fsp.rm(userProjectPath, { recursive: true, force: true });
  await fsp.mkdir(userProjectPath, { recursive: true });
  process.stdout.write(chalk.green('\t\t\t✔\n'));
};

const cloneBoilerplate = async (userProjectInfo: UserProjectInfo, url: string) => {
  process.stdout.write(chalk.cyan('Cloning the boilerplate repository...'));
  const userProjectPath = path.resolve(process.cwd(), `./${userProjectInfo.name}`);
  try {
    await execAsync(`git clone "${url}" --depth 1 .`, {
      cwd: userProjectPath,
    });
    process.stdout.write(chalk.green('\t\t✔\n'));
  } catch (err) {
    process.stdout.write(chalk.red('\t\t✘\n'));
    console.error(err);
    return process.exit(ERRORS.BOILERPLATE_CLONE_FAILED);
  }
};

const updatePackageInfo = async (userProjectInfo: UserProjectInfo) => {
  process.stdout.write(chalk.cyan('Updating package info...'));
  const userProjectPath = path.resolve(process.cwd(), `./${userProjectInfo.name}`);
  const packageJsonPath = path.resolve(userProjectPath, './package.json');
  if (!fs.existsSync(packageJsonPath)) {
    process.stdout.write(chalk.red('\t\t✘\n'));
    return process.exit(ERRORS.PACKAGE_JSON_NOT_FOUND);
  }
  try {
    const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }));
    const { name, author, license, desc, version } = userProjectInfo;
    Object.assign(packageInfo, {
      name,
      author,
      license,
      version,
      description: desc,
    });
    UNNECESSARY_PACKAGE_PROPERTIES.forEach((key) => {
      delete packageInfo[key];
    });
    await fsp.writeFile(packageJsonPath, JSON.stringify(packageInfo, null, '  '), {
      encoding: 'utf-8',
    });
    process.stdout.write(chalk.green('\t\t\t✔\n'));
  } catch (err) {
    process.stdout.write(chalk.red('\t\t\t✘\n'));
    console.error(err);
    return process.exit(ERRORS.UPDATE_PACKAGE_INFO_FAILED);
  }
};

const installDeps = async (userProjectInfo: UserProjectInfo) => {
  process.stdout.write(chalk.cyan('Installing dependencies of project...'));
  const userProjectPath = path.resolve(process.cwd(), `./${userProjectInfo.name}`);
  try {
    await execAsync(`npm install`, {
      cwd: userProjectPath,
    });
    process.stdout.write(chalk.green('\t\t✔\n'));
  } catch (err) {
    process.stdout.write(chalk.red('\t\t✘\n'));
    console.error(err);
    return process.exit(ERRORS.BOILERPLATE_CLONE_FAILED);
  }
};

const initGitRepo = async (userProjectInfo: UserProjectInfo) => {
  process.stdout.write(chalk.cyan('Installing git repository...'));
  const userProjectPath = path.resolve(process.cwd(), `./${userProjectInfo.name}`);
  const gitDataPath = path.resolve(userProjectPath, './.git');
  try {
    if (fs.existsSync(gitDataPath)) {
      // whether user determined, remove the original .git folder
      await fsp.rm(gitDataPath, { recursive: true, force: true });
    }
    await execAsync('git init', {
      cwd: userProjectPath,
    });
    process.stdout.write(chalk.green('\t\t\t✔\n'));
  } catch (err) {
    process.stdout.write(chalk.red('\t\t\t✘\n'));
    console.error(err);
    return process.exit(ERRORS.BOILERPLATE_CLONE_FAILED);
  }
};

const init = async (url: string) => {
  if (!GIT_REPO_URL_CHECKER.test(url)) {
    console.log(chalk.red('URL is not a valid git repository.'));
    return process.exit(ERRORS.REPO_URL_INVALID);
  }
  const userProjectInfo = await getUserProjectInfo();
  await checkUserProjectEnv(userProjectInfo);
  await cloneBoilerplate(userProjectInfo, url);
  await updatePackageInfo(userProjectInfo);
  await installDeps(userProjectInfo);
  await initGitRepo(userProjectInfo);
  console.log(chalk.green(`\nAll things done, you can open up your project right now~\n\n`));
};

export default init;
