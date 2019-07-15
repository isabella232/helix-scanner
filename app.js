const http = require('http');
const request = require("request");
const Octokit = require('@octokit/rest');
const octokit = new Octokit({
    auth: process.env.HELIX_SCANNER_GITHUB_AUTH_TOKEN,
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
    host: process.env.HELIX_SCANNER_POSTGRESQL_DB_HOST,
    user: process.env.HELIX_SCANNER_POSTGRESQL_DB_USER,     
    password: process.env.HELIX_SCANNER_POSTGRESQL_DB_PASSWORD,
    database: process.env.HELIX_SCANNER_POSTGRESQL_DB_NAME,
    port: 5432,
    ssl: true
};
const client = new pg.Client(config);

const hostname = '127.0.0.1';
const port = 3000;
const path = 'hackathons/';


const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

const parseMarkdown = text => text.match(/^# (.*)\n/m)[1];

// key: url (string)
// val: title (string)
let titles = {};

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);

    // grab content metadata with a specific path
    octokit.paginate('GET /repos/:owner/:repo/contents/:path',
        { owner: 'adobe', repo: 'helix-home', path: path },
        response => response.data.filter(file => 
            file.type == 'file' && file.name.includes('.md'))
    )
    .then(files => files.map(file => {
        // get the actual contents of files
        octokit.paginate('GET /repos/:owner/:repo/git/blobs/:file_sha',
            { owner: 'adobe', repo: 'helix-home', file_sha: file.sha }
        )
        // only 1 response object in an array
        .then(response => response.map(
            data => {
                let url = data.url;
                let buff = Buffer.from(data.content, 'base64');  
                let text = buff.toString('ascii');
                titles[url] = parseMarkdown(text);
            }
        ));
    }));

    client.connect(err => {
        console.log(titles);
        if (err) throw err;
        else {
            queryDatabase(titles, path)
        }
    });

    function queryDatabase(titles, path) {
    
        console.log(`Running query to PostgreSQL server: ${config.host}`);

        let final_query = '';
        Object.keys(titles).map((url) => {
            const title = titles[url];
            console.log('title: ', title);
            console.log('url: ', url);
            const query = `INSERT INTO documents (url, title, path) VALUES ('${url}', '${title}', '${path}');`;
            console.log('query: ',query);
            final_query.concat(query);
        });

        console.log('final query looks like: ', final_query);

        client.query(final_query)
            .then(res => {
                // const rows = res.rows;

                // rows.map(row => {
                //     console.log(`Read: ${JSON.stringify(row)}`);
                // });

                client.end(console.log('Closed client connection'));
            })
            .catch(err => {
                console.log(err);
            })
            .then(() =>
                process.exit()
            );
    }

});