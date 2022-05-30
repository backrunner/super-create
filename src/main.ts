import commander from 'commander';
import initAction from './actions/init';
import { name, version } from '../package.json';

const program = new commander.Command();

program.name(name);
program.version(version);

program.argument('<repo>', 'URL of boilerplate repo').action(initAction);

program.parse();
