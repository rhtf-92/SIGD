const argon2 = require('argon2');
argon2.hash('Suiza2026', {type: argon2.argon2id}).then(h=>{console.log('HASH:',h)}).catch(e=>console.error(e));
