const http = require('http');
const request = require("request");
const Octokit = require('@octokit/rest');
const octokit = new Octokit({
    auth: '8a3525e5b6e73039b6cc2f1f48534a98e4fdd4bc',
    baseUrl: 'https://api.github.com',
    log: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error
    },
    request: {
        agent: undefined,
        fetch: undefined,
        timeout: 0
    }
});

const pg = require('pg');

const config = {
    host: 'helix-azure-gql.postgres.database.azure.com',
    // Do not hard code your username and password.
    // Consider using Node environment variables.
    user: 'hasura@helix-azure-gql',     
    password: 'Csisfun0',
    database: 'helix-azure-gql',
    port: 5432,
    ssl: true
};
const client = new pg.Client(config);

const hostname = '127.0.0.1';
const port = 3000;


const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

const parseMarkdown = text => {
    let title = text.match(/^# (.*)\n/m)[1];
    console.log(title);
}

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);

    // grab content metadata with a specific path
    octokit.paginate('GET /repos/:owner/:repo/contents/:path',
        { owner: 'adobe', repo: 'helix-home', path: 'hackathons/' },
        response => response.data.filter(file => 
            file.type == 'file' && file.name.includes('.md'))
    )
    .then(files => files.map(file => {
        // get the actual contents of files
        octokit.paginate('GET /repos/:owner/:repo/git/blobs/:file_sha',
            { owner: 'adobe', repo: 'helix-home', file_sha: file.sha },
            response => response.data.content)
        .then(content => {
            let buff = Buffer.from(content[0], 'base64');  
            let text = buff.toString('ascii');
            parseMarkdown(text);
        });
    }));

    /*
    client.connect(err => {
        if (err) throw err;
        else { queryDatabase(); }
    });

    function queryDatabase() {
    
        console.log(`Running query to PostgreSQL server: ${config.host}`);

        const query = 'SELECT * FROM markdowns;';

        client.query(query)
            .then(res => {
                const rows = res.rows;

                rows.map(row => {
                    console.log(`Read: ${JSON.stringify(row)}`);
                });

                process.exit();
            })
            .catch(err => {
                console.log(err);
            });
    }
    */
});