import express from 'express';
import {RedisClient} from 'redis';

const MAX_LENGTH = 5;
const HOST_PORT = 'http://localhost:8080/';
const REDIS = 'localhost'; // change this with 'service.redis'
const REDIRECT = true;

// console.log(new URL('http://localhost:8080/'));

function validURL(str:string) {
    var pattern = new RegExp('^(https?:\\/\\/)'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
}

function set_redis(client:RedisClient, key:string, value:string, timeout:number=1000) {
    return new Promise<boolean>((resolve, reject) => {
        client.set(key, value, (err) => {
            if (err)
                resolve(false);
            resolve(true);
        });
        setTimeout(() => resolve(false), timeout);
    });
}

async function main() {
    const app = express();
    const client = new RedisClient({port: 6379, host: REDIS});

    app.use(express.urlencoded({extended: true}));

    try {
        await new Promise<void>((resolve, reject) => {
            client.on('ready', () => resolve()); 
            setTimeout(() => reject(), 1000);
        });
    } catch (error) {
        console.log(error);
        return;
    }

    console.log('Redis connected');

    app.get('/', (req, res) => {
        var error = req.query.error;
        if (error) {
            var message = 'This is not a proper URL';
        }
        else {
            var message = '';
        }
        
        
        var html = `
        <p>Your link must start with the protocol. For example: http://www.google.com</p>
        <form action="/" method="post">
            <label for="long">Link: </label><br>
            <input type="text" id="long" name="long" value=""><br>
            <input type="submit" value="Shorten Link">
        </form> 
        <p>${message}</p>
        `;

        res.send(html);
    });
    
    app.get('/:id', async (req, res) => {
        var short = req.params.id;
        client.get(`urls:${short}`, (err, reply) => {
            if (reply) {
                if (REDIRECT) {
                    res.redirect(reply);
                }
                else {
                    res.status(200).send(`<p>Your Link: <a href="${reply}">${reply}</a></p>`);
                }
            } else {
                res.status(404).send('<p>Link not found</p>');
            }
        });
    });

    app.post('/', async (req, res) => {
        var long:string = req.body.long;
        if (typeof long != typeof "") {
            res.status(400).send('"Bad Request"');
            return;
        }

        long = long.replace(/\s/g, "");
        

        if (!validURL(long)) {
            res.redirect(`${HOST_PORT}?error=true`);
            return;
        }

        var hashed = Buffer.from(long, 'utf-8').toString('base64');
        var short = hashed.substring(0, MAX_LENGTH);
        
        var success = await set_redis(client, `urls:${short}`, long);
        if (!success) {
            res.status(500).send('"Internal Server Error"');
            return;
        }
        res.status(200).send(`<p>Done! <a href="${HOST_PORT}${short}">http://localhost:8080/${short}</a></p>`);
    });

    app.listen(8080, () => {
        console.log(`server started on ${HOST_PORT}`);
    });
}
main();
