import childProcess from 'child_process';
import chalk from 'chalk';

const errorKeywords = ['error: '];

export const execAsync = (cmd: string, options?: childProcess.ExecOptions): Promise<void> => {
  const child = childProcess.exec(cmd, options);
  return new Promise((resolve, reject) => {
    child.stdout?.on('data', (data) => {
      const containsError = errorKeywords.reduce((res, curr) => {
        if (res) return res;
        return res || data.toLowerCase().includes(curr);
      }, false);
      if (containsError) {
        console.error(chalk.red(data));
      }
    });
    child.stderr?.on('data', (data) => {
      const containsError = errorKeywords.reduce((res, curr) => {
        if (res) return res;
        return res || data.toLowerCase().includes(curr);
      }, false);
      if (containsError) {
        console.error(chalk.red(data));
      }
    });
    child.on('exit', (code) => {
      if (code === 0) {
        return resolve();
      }
      reject(code);
    });
  });
};
