/*
    0 -> node path
    1 -> app path
    2 -> owner name
    3 -> repo name
    4 -> path name (default to root)
*/
const minimist = require('minimist');

let args = minimist(process.argv.slice(2), {  
    alias: {
        o: 'owner',
        r: 'repo',
        p: 'path',
    },
    default: {
        o: 'adobe',
        r: 'helix-home',
        p: 'hackathons/',
    },
});

const owner = args['o'];
const repo = args['r'];
const path = args['p'];

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


const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

/*
    if the directory contains header.md or footer.md,
    it is very likely that they do not have a commonly defined title such as '# TITLE'
*/
const parseMarkdown = text => {
    const match_res = text.match(/^# (.*)\n/m);
    if (match_res) {
        // since i am using () to group the regex, it will be stored as
        // ['# TITLE', 'TITLE] and we are interested in the ele in pos 1
        return match_res[1];
    }
};

/*
    key: url (string)
    val: title (string)
*/
let titles = {};
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);

    const base_url =  `https://github.com/${owner}/${repo}/raw/master/${path}`;

    // grab content metadata with a specific path
    octokit.paginate('GET /repos/:owner/:repo/contents/:path',
        { owner: owner, repo: repo, path: path },
        response => response.data.filter(file => 
            file.type == 'file' && file.name.includes('.md')
        )
    )
    .then(files => files.map(file => {
        const url = base_url.concat(file.name)
        titles[url] = undefined;
        console.log('outside request: ', url);
        console.log('titles: ', titles);
    })).then(() => {
        Object.keys(titles).map((url) => {
            // get the actual contents of files
            request(url, { json: false }, (err, res, body) => {
                if (err) throw err;
                titles[url] = parseMarkdown(body);
            });
        });
    }).then(() => {
        client.connect(err => {
            if (err) throw err;
            else {
                queryDatabase(titles, path);
            }
        });
    });

    function queryDatabase(titles, path) {
    
        console.log(`Running query to PostgreSQL server: ${config.host}`);

        let final_query = '';
        Object.keys(titles).map((url) => {
            const title = titles[url];
            const query = `INSERT INTO documents_demo (url, title, path) VALUES ('${url}', '${title}', '/${owner}/${repo}/${path}');`;
            final_query = final_query.concat(query);
        });

        console.log('final query: ', final_query);

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
