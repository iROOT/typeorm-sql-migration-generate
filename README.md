# TypeORM SQL Migration Generator

The TypeORM SQL Migration Generator is a repository containing an improved implementation of the TypeORM migration generator. This implementation separates the JavaScript code and the executable SQL code and stores them in separate `*.up.sql` and `*.down.sql` files, respectively. This separation of concerns allows for better management of SQL scripts and enables easier collaboration among developers.

## Getting Started

To get started with using the TypeORM SQL Migration Generator, follow the steps below:

1. Clone the repository to your local machine.

```bash
git clone https://github.com/iroot/typeorm-sql-migration-generate.git
```

2. Install the dependencies.

```bash
npm install
```

3. Start the development server.

```bash
npm run dev
```

## Usage

Once the development server is running, you can generate new migrations using the following command:

```bash
npm run migration:generate -- -n <migration-name>
```

The `migration-name` parameter specifies the name of the migration that you want to create. After running the command, the generator will create two files in the `src/migrations` folder: a `*.up.sql` file and a `*.down.sql` file. You can then add your SQL code to these files as needed.

## Contributing

If you want to contribute to the TypeORM SQL Migration Generator, follow the steps below:

1. Fork the repository.

2. Create a new branch for your changes.

```bash
git checkout -b <branch-name>
```

3. Make your changes and commit them.

```bash
git commit -m "<commit-message>"
```

4. Push your changes to your fork.

```bash
git push origin <branch-name>
```

5. Open a pull request to the main repository.

## License

The TypeORM SQL Migration Generator is licensed under the MIT License.
