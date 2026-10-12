#!/usr/bin/env node
import { main } from './garde.mjs';

process.exitCode = main(process.argv.slice(2));
