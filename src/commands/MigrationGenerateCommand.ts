import { CommandUtils } from "./CommandUtils";
import { camelCase } from "../util/StringUtils";
import * as yargs from "yargs";
import chalk from "chalk";
import { format } from "@sqltools/formatter/lib/sqlFormatter";
import { PlatformTools } from "../platform/PlatformTools";
import { DataSource } from "typeorm";
import * as path from "path";
import process from "process";

/**
 * Generates a new migration file with sql needs to be executed to update schema.
 */
export class MigrationGenerateCommand implements yargs.CommandModule {
  command = "migration:generate <path>";
  describe =
    "Generates a new migration file with sql needs to be executed to update schema.";

  builder(args: yargs.Argv) {
    return args
      .option("dataSource", {
        alias: "d",
        type: "string",
        describe: "Path to the file where your DataSource instance is defined.",
        demandOption: true,
      })
      .option("p", {
        alias: "pretty",
        type: "boolean",
        default: false,
        describe: "Pretty-print generated SQL",
      })
      .option("o", {
        alias: "outputJs",
        type: "boolean",
        default: false,
        describe:
          "Generate a migration file on Javascript instead of Typescript",
      })
      .option("dr", {
        alias: "dryrun",
        type: "boolean",
        default: false,
        describe:
          "Prints out the contents of the migration instead of writing it to a file",
      })
      .option("ch", {
        alias: "check",
        type: "boolean",
        default: false,
        describe:
          "Verifies that the current database is up to date and that no migrations are needed. Otherwise exits with code 1.",
      })
      .option("t", {
        alias: "timestamp",
        type: "number",
        default: false,
        describe: "Custom timestamp for the migration name",
      })
      .option("s", {
        alias: "sql",
        type: "string",
        describe: "Path to write sql files.",
        demandOption: true,
      });
  }

  async handler(args: yargs.Arguments) {
    const timestamp = CommandUtils.getTimestamp(args.timestamp);
    const extension = args.outputJs ? ".js" : ".ts";
    const fullPath = (args.path as string).startsWith("/")
      ? (args.path as string)
      : path.resolve(process.cwd(), args.path as string);
    const fullPathSqlMigrations = (args.sql as string).startsWith("/")
      ? (args.sql as string)
      : path.resolve(process.cwd(), args.sql as string);
    const filename = timestamp + "-" + path.basename(fullPath) + extension;
    const filenameSqlUp = timestamp + "-" + path.basename(fullPath) + ".up.sql";
    const filenameSqlDown =
      timestamp + "-" + path.basename(fullPath) + ".down.sql";

    let dataSource: DataSource | undefined = undefined;
    try {
      dataSource = await CommandUtils.loadDataSource(
        path.resolve(process.cwd(), args.dataSource as string)
      );
      dataSource.setOptions({
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
        logging: false,
      });
      await dataSource.initialize();

      const upSqls: string[] = [],
        downSqls: string[] = [];

      try {
        const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();

        if (args.pretty) {
          sqlInMemory.upQueries.forEach((upQuery) => {
            upQuery.query = MigrationGenerateCommand.prettifyQuery(
              upQuery.query
            );
          });
          sqlInMemory.downQueries.forEach((downQuery) => {
            downQuery.query = MigrationGenerateCommand.prettifyQuery(
              downQuery.query
            );
          });
        }

        sqlInMemory.upQueries.forEach((upQuery) => {
          upSqls.push(upQuery.query.replace(new RegExp("`", "g"), "\\`"));
        });
        sqlInMemory.downQueries.forEach((downQuery) => {
          downSqls.push(downQuery.query.replace(new RegExp("`", "g"), "\\`"));
        });
      } finally {
        await dataSource.destroy();
      }

      if (!upSqls.length) {
        if (args.check) {
          console.log(chalk.green(`No changes in database schema were found`));
          process.exit(0);
        } else {
          console.log(
            chalk.yellow(
              `No changes in database schema were found - cannot generate a migration. To create a new empty migration use "typeorm migration:create" command`
            )
          );
          process.exit(1);
        }
      } else if (!args.path) {
        console.log(chalk.yellow("Please specify a migration path"));
        process.exit(1);
      }

      const fileContent = args.outputJs
        ? MigrationGenerateCommand.getJavascriptTemplate(
            path.basename(fullPath),
            timestamp,
            filenameSqlUp,
            filenameSqlDown
          )
        : MigrationGenerateCommand.getTemplate(
            path.basename(fullPath),
            timestamp,
            filenameSqlUp,
            filenameSqlDown
          );
      const fileContentSqlUp = upSqls.join(";\n") + (upSqls.length ? ";" : "");
      const fileContentSqlDown =
        downSqls.reverse().join(";\n") + (downSqls.length ? ";" : "");

      if (args.check) {
        console.log(
          chalk.yellow(
            `Unexpected changes in database schema were found in check mode:\n\n${chalk.white(
              fileContent
            )}`
          )
        );
        process.exit(1);
      }

      if (args.dryrun) {
        console.log(
          chalk.green(
            `Migration ${chalk.blue(
              fullPath + extension
            )} has content:\n\n${chalk.white(fileContent)}`
          )
        );
      } else {
        const migrationFileName = path.dirname(fullPath) + "/" + filename;
        const migrationFileNameSqlUp =
          fullPathSqlMigrations + "/" + filenameSqlUp;
        const migrationFileNameSqlDown =
          fullPathSqlMigrations + "/" + filenameSqlDown;
        await CommandUtils.createFile(migrationFileName, fileContent);
        await CommandUtils.createFile(migrationFileNameSqlUp, fileContentSqlUp);
        await CommandUtils.createFile(
          migrationFileNameSqlDown,
          fileContentSqlDown
        );

        console.log(
          chalk.green(
            `Migration ${chalk.blue(
              migrationFileName
            )} has been generated successfully.`
          )
        );
        process.exit(0);
      }
    } catch (err) {
      PlatformTools.logCmdErr("Error during migration generation:", err);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // Protected Static Methods
  // -------------------------------------------------------------------------

  /**
   * Formats query parameters for migration queries if parameters actually exist
   */
  protected static queryParams(parameters: any[] | undefined): string {
    if (!parameters || !parameters.length) {
      return "";
    }

    return `, ${JSON.stringify(parameters)}`;
  }

  /**
   * Gets contents of the migration file.
   */
  protected static getTemplate(
    name: string,
    timestamp: number,
    filenameSqlUp: string,
    filenameSqlDown: string
  ): string {
    const migrationName = `${camelCase(name, true)}${timestamp}`;

    return `import { readFileSync } from 'fs';

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
    public name = '${migrationName}';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const sql = readFileSync(\`\${process.cwd()}/migrations/${filenameSqlUp}\`).toString();
        await queryRunner.query(sql);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const sql = readFileSync(\`\${process.cwd()}/migrations/${filenameSqlDown}\`).toString();
        await queryRunner.query(sql);
    }
}
`;
  }

  /**
   * Gets contents of the migration file in Javascript.
   */
  protected static getJavascriptTemplate(
    name: string,
    timestamp: number,
    filenameSqlUp: string,
    filenameSqlDown: string
  ): string {
    const migrationName = `${camelCase(name, true)}${timestamp}`;

    return `const { readFileSync } = require('fs');

const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class ${migrationName} {
    name = '${migrationName}';

    async up(queryRunner) {
        const sql = readFileSync(\`\${process.cwd()}/migrations/${filenameSqlUp}\`).toString();
        await queryRunner.query(sql);
    }

    async down(queryRunner) {
        const sql = readFileSync(\`\${process.cwd()}/migrations/${filenameSqlDown}\`).toString();
        await queryRunner.query(sql);
    }
}
`;
  }

  /**
   *
   */
  protected static prettifyQuery(query: string) {
    const formattedQuery = format(query, { indent: "    " });
    return "\n" + formattedQuery.replace(/^/gm, "            ") + "\n        ";
  }
}
