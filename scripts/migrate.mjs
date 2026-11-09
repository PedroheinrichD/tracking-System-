// Cria o banco (se não existir) e aplica, em ordem, os arquivos de db/migrations
// que ainda não foram registrados em schema_migrations.
// Uso: npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const config = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
};
const database = process.env.DB_NAME ?? "sob_medida_ats";

if (!/^[A-Za-z0-9_]+$/.test(database)) {
  console.error(`DB_NAME inválido: "${database}". Use apenas letras, números e _.`);
  process.exit(1);
}

const migrationsDir = path.resolve("db", "migrations");

async function main() {
  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: true,
    charset: "UTF8MB4_UNICODE_CI",
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.changeUser({ database });
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(190) NOT NULL PRIMARY KEY,
        applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await connection.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name));
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      process.stdout.write(`Aplicando ${file}... `);
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
      console.log("ok");
      count += 1;
    }

    console.log(
      count === 0
        ? `Banco "${database}" já está atualizado.`
        : `${count} migração(ões) aplicada(s) em "${database}".`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Falha ao migrar o banco:", error.message);
  if (error.code === "ECONNREFUSED") {
    console.error("Verifique se o MySQL/MariaDB está em execução e se DB_HOST/DB_PORT estão corretos.");
  }
  process.exit(1);
});
