/**
 * Vocabulário técnico usado pelas salvaguardas para detectar tecnologias citadas
 * no currículo personalizado que não existem no original. Ficam de fora termos
 * curtos ou ambíguos em português/inglês (go, r, c, less, next…), que gerariam
 * falsos positivos; as palavras-chave da própria vaga complementam esta lista.
 */
export const TECH_LEXICON: string[] = [
  // Linguagens
  "JavaScript", "TypeScript", "Python", "Java", "Kotlin", "Swift", "Objective-C", "C#", "C++", "PHP",
  "Ruby", "Golang", "Rust", "Scala", "Elixir", "Erlang", "Clojure", "Haskell", "Perl", "Dart",
  "Groovy", "MATLAB", "COBOL", "Delphi", "VB.NET", "Visual Basic", "Solidity", "Bash", "PowerShell",
  "Shell Script", "SQL", "PL/SQL", "T-SQL", "GraphQL", "HTML", "CSS", "Sass", "SCSS",
  // Front-end
  "React", "React Native", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "SvelteKit",
  "Gatsby", "jQuery", "Redux", "Zustand", "MobX", "RxJS", "Tailwind CSS", "Bootstrap", "Material UI",
  "Chakra UI", "Styled Components", "Storybook", "Webpack", "Vite", "Babel", "ESLint",
  "Three.js", "D3.js", "Ionic", "Electron", "Flutter", "Xamarin",
  // Back-end
  "Node.js", "Express", "NestJS", "Fastify", "Django", "Flask", "FastAPI", "Spring Boot",
  "Hibernate", "Quarkus", "Laravel", "Symfony", "CodeIgniter", "Ruby on Rails", ".NET", "ASP.NET",
  "Entity Framework", "Prisma", "Sequelize", "TypeORM", "Mongoose", "Drizzle",
  "gRPC", "WebSocket", "Socket.IO", "RabbitMQ", "Kafka", "Celery", "Sidekiq",
  // Dados
  "MySQL", "PostgreSQL", "MariaDB", "SQLite", "Oracle Database", "SQL Server", "MongoDB", "Redis",
  "Cassandra", "DynamoDB", "Firestore", "Elasticsearch", "Neo4j", "Snowflake", "BigQuery", "Redshift",
  "Databricks", "Apache Spark", "Hadoop", "Airflow", "dbt", "Power BI", "Tableau", "Looker", "Metabase",
  "Pandas", "NumPy", "scikit-learn", "TensorFlow", "PyTorch", "Keras", "LangChain", "OpenCV",
  // Nuvem e DevOps
  "AWS", "Azure", "GCP", "Firebase", "Supabase", "Vercel", "Netlify", "Heroku", "DigitalOcean",
  "Docker", "Kubernetes", "Helm", "Terraform", "Ansible", "Pulumi", "Jenkins", "GitHub Actions",
  "GitLab CI", "CircleCI", "Travis CI", "ArgoCD", "Nginx", "Apache Kafka", "Prometheus", "Grafana",
  "Datadog", "New Relic", "Sentry", "Linux", "Serverless", "AWS Lambda", "EC2", "S3", "CloudFormation",
  // Testes e qualidade
  "Jest", "Vitest", "Mocha", "Chai", "Cypress", "Playwright", "Selenium", "Puppeteer", "JUnit",
  "Mockito", "PyTest", "RSpec", "Testing Library", "SonarQube", "TDD", "BDD",
  // Ferramentas e práticas
  "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence", "Trello", "Figma", "Adobe XD",
  "Photoshop", "Illustrator", "Postman", "Swagger", "OpenAPI", "Scrum", "Kanban",
  "DDD", "SOLID", "Clean Architecture", "Microsserviços", "Microservices", "CI/CD", "DevOps", "SRE",
  "OAuth", "JWT", "Keycloak", "SAP", "Salesforce", "ServiceNow", "VBA", "WordPress", "Shopify",
  "Magento", "SEO", "Google Analytics", "PWA", "WCAG", "Unreal Engine",
];

/**
 * Termos de senioridade/escopo. No título e no resumo, a presença de um destes
 * sem respaldo no original indica inflação de nível.
 */
export const SENIORITY_TERMS: string[] = [
  "sênior", "senior", "pleno", "júnior", "junior", "especialista", "specialist", "expert", "lead",
  "tech lead", "líder técnico", "líder", "head", "staff", "principal", "arquiteto", "architect",
  "coordenador", "gerente", "manager",
];
