# helix-scanner
a node js app that scans all markdown documents in a repository under a specific path, then grabs its title and inserts into PostgresQL database

## start the app
node app.js -- owner github/repo/ownder/name --repo github/repo/name --path github/path/name
> the repo owner defaults to `adobe`, repo name defaults to `helix-home`, and path defaults to `''` which is root

## some useful links
github apis: https://developer.github.com/v3/repos/#list-organization-repositories

github nodejs apis: https://github.com/octokit/rest.js

install azure cli: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest

create azure container with postgreSQL: https://docs.hasura.io/1.0/graphql/manual/guides/deployment/azure-container-instances-postgres.html

connect nodejs app to postgreSQL database: https://docs.microsoft.com/en-us/azure/postgresql/connect-nodejs

online regex expression (can customize flags too): https://regex101.com/
