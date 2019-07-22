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
const request = require("request-promise");
const dotenv = require('dotenv');
dotenv.config();

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
const server_port = 3001;

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
let json_entries = {};
server.listen(server_port, hostname, () => {
    console.log(`Server running at http://${hostname}:${server_port}/`);

    const base_url =  `http://localhost:3000/`;

    const revision = require('child_process')
    .execSync('git rev-parse HEAD')
    .toString().trim()

    const execQuery = (table_name, path, title) => {
        const query = `INSERT INTO ${table_name} (path, title, description) VALUES ('${path}', '${title}');`;
        console.log(`Preparing to execute query ${query}`)
        client.query(query)
            .catch(err => {
                console.log(`Error executing database query '${query}': `, err)
            })
    }

    const traverseTree = () => octokit.git.getTree({
        owner: owner,
        repo: repo,
        tree_sha: revision,
        recursive: 1,
    }).then(response => 
        response.data.tree.filter(obj => obj.type === 'blob' && !obj.path.startsWith('.github') && obj.path.endsWith('.md'))
    ).then(files => 
        files.map(file => {
            const wrapper = {}
            const idx_html = file.path.replace('.md', '.idx.html')
            wrapper[base_url.concat(idx_html)] = file.path
            return wrapper
        })
    ).then(urls => urls.map((url_object) => {
        for (const [url, path] of Object.entries(url_object)) {
            request({uri: url, json: true})
            .then(content => {
                console.log('the request url is: ', url)
                console.log('the title of this url is: ', content.tables[0].entries)
                console.log('the entire content block looks like: ', content)
                content.tables.map(table => execQuery(table.name, path, table.entries.title))
            })}
        }
    ))

    client.connect(err => {
        if (err) throw err;
        else {
            console.log('PostgresDB connected.')
            traverseTree()
        }
    })
});
