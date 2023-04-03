#!/usr/bin/env node
import "reflect-metadata";
import yargs from "yargs";
import { MigrationGenerateCommand } from "./commands/MigrationGenerateCommand";

yargs
  .usage("Usage: $0 <command> [options]")
  .command(new MigrationGenerateCommand())
  .recommendCommands()
  .demandCommand(1)
  .strict()
  .alias("v", "version")
  .help("h")
  .alias("h", "help").argv;
