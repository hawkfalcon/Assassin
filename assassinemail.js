var notifier = require('mail-notifier')
var nodemailer = require('nodemailer')
var fs = require('fs')
var MongoClient = require('mongodb').MongoClient
    , format = require('util').format;
var players = require('./players.json')

var imap = {
    user: 'email@email.com',
    password: 'password',
    host: 'imap.yandex.com',
    port: 993, // imap port
    tls: true,// use secure connection
    tlsOptions: {rejectUnauthorized: false}
}

// SMTP Email Sender
var transporter = nodemailer.createTransport({
    service: 'Yandex',
    auth: {
        user: 'email@email.com',
        pass: 'password'
    }
})

var messages = {
    welcome: 'You are now in the game of Assassin! You will receive your target when signups are closed.',
    target_assigned: 'You have been assigned a target: %replace%.' +
    '\n\nWhen you kill your assassin, type \'TARGET ELIMINATED\' to receive your next target.\nGood luck!',
    new_target: 'Your target confirmed that you killed them.\nYou have been assigned new target: %replace%.\nGood luck!',
    verify_death: 'Your Assassin reported that you are dead. If this correct?\n \'YES/NO\'',
    target_denied_kill: 'Target denied that you killed them. Please resolve this.',
    denied_kill: 'Your assassin was notified that you deny that they killed you. Please resolve this.'
}

// Options: run the server, generate 
// and send out targets, eliminate
function checkArguments() {
    var args = process.argv
    if (args.length <= 2) {
        console.log('Please provide an argument')
    } else {
        var arg = args[2]
        if (arg == 'server') {
            listener.start()
        } else if (arg == 'send') {
            sendInitialTargets()
        } else if (arg == 'players') {
            generatePlayersFromMongo()
        } else if (args.length > 3) {
            if (arg == 'command') {
                receiveCommand(args[3].toUpperCase(), '1234567890')
            } else if (arg == 'eliminate') {
                var target = ''
                process.argv.forEach(function (val, index) {
                    if (index >= 3) {
                        target += val
                        target += ' '
                    }
                });
                verifiedDeath(target.trim())
            } else {
                console.log('Who would you like to eliminate?')
            }
        } else {
            console.log('Invalid arguements')
        }
    }
}

//I'll use this to get commands via email/text
var listener = notifier(imap).on('mail', function (mail) {
    console.log('Got a Message')
    var from = mail.headers.from
    console.log(from)
    if (from.indexOf('post_master') > -1 || from.indexOf('mailer-daemon') > -1) {
        console.log("Bounced email")
    } else {
        var parsed = ''
        if(mail.attachments) {
            mail.attachments.forEach(function(attachment){
                var contents = attachment.content.toString('utf-8')
                console.log(contents)
                parsed = contents.toUpperCase()
            });
        } else {
            parsed = mail.text.split('-----')[0].toUpperCase()
            console.log(parsed)
        }
        var phone = mail.headers.from.split('@')[0]
        console.log(phone)
        receiveCommand(parsed, phone)
    }
})

function receiveCommand(command, phone) {
    console.log(command)
    var name = getNameFromPhone(phone)
    console.log(name)
    if (name === null) {
        name = ''
    }
    console.log(name)
    if (command.indexOf('COMMAND') > -1) {
        console.log('RECEIVED COMMAND')
    } else if (command.indexOf('CONFIRM') > -1) {
        console.log('CONFIRMING')
        confirmMongo(phone)
        sendMessage(name, phone, 'welcome')
    } else if (command.indexOf('ELIMINATED') > -1) {
        deathConfirmation(name)
    } else if (command.indexOf('YES') > -1) {
        verifiedDeath(name)
    } else if (command.indexOf('NO') > -1) {
        noVerification(name)
    } else if (command.indexOf('SECRETCMD') > -1) {
        mongoKill('Person Person')
    } else {
        console.log('NO COMMANDS D:')
    }
}

//Generate targets from json, send out emails
function sendInitialTargets() {
    var targets = []
    var next = 0
    var shuffled = shuffle(players)
    shuffled.forEach(function (player) {
        var name = player.name
        var phone = player.phone
        next++
        if (next == shuffled.length) {
            next = 0
        }
        var target = shuffled[next].name
        console.log('Player: ' + name + ' -- ' + phone + ' --> Target: ' + target)
        targets.push({
            'name': name,
            'target': target
        })
        sendMessage(name, phone, 'target_assigned', target)
    })
    writeJson('targets', targets)
}

function writeVerify(name, target) {
    console.log('WRITING VERIFY FILE')
    var verify = require('./verify.json')
    verify[target] = name
    writeJson('verify', verify)
}

function noVerification(sender) {
    var targets = require('./targets.json')
    targets.forEach(function (player) {
        var targetname = player.target
        if (targetname == sender) {
            var playername = player.name
            console.log(playername + ' did not receive confirmation from ' + targetname)
            var targetphone = getPhoneFromName(targetname)
            var phone = getPhoneFromName(playername)
            sendMessage(targetname, targetphone, 'denied_kill')
            sendMessage(playername, phone, 'target_denied_kill')
        }
    })
}

function deathConfirmation(sender) {
    var targets = require('./targets.json')
    targets.forEach(function (player) {
        var playername = player.name
        if (playername == sender) {
            var targetname = player.target
            console.log(playername + ' needs confirmation from ' + targetname)
            var phone = getPhoneFromName(targetname)
            sendMessage(targetname, phone, 'verify_death')
            writeVerify(playername, targetname)
        }
    })
}

function verifiedDeath(target) {
    console.log(target + 'VERIFIED DEATH')
    var verify = require('./verify.json')
    if (verify.hasOwnProperty(target)) {
        var name = verify[target]
        eliminatedTarget(name)
        mongoKill(name)
        delete verify[target]
        writeJson('verify', verify)
    }
}

function eliminatedTarget(sender) {
    var targets = require('./targets.json')
    var save = false
    targets.forEach(function (player) {
        var playername = player.name
        if (playername == sender) {
            var targetname = player.target
            console.log(playername + ' killed ' + targetname)
            targets.forEach(function (target) {
                if (target.name == targetname) {
                    var newtarget = target.target
                    player.target = newtarget
                    target.target = 'ELIMINATED'
                    save = true
                    var phone = getPhoneFromName(playername)
                    sendMessage(playername, phone, 'new_target',  newtarget)
                }
            })
        }
    })
    if (save) {
        writeJson('targets', targets)
    }
}

// Write a pretty json file
function writeJson(file, json) {
    fs.writeFile(file + '.json', JSON.stringify(json, null, 2), function (err) {
        if (err) {
            console.log(err)
        } else {
            console.log('JSON file ' + file + ' saved')
        }
    })
}

function generatePlayersFromMongo() {
    MongoClient.connect('mongodb://127.0.0.1:3001/meteor', function (err, db) {
        var collection = db.collection('players')
        collection.find({}).toArray(function(err, players) {
            if (err) throw err
            console.log('Found the following records');
            console.log(players)
            writeJson('players', players)
            /*players.forEach(function (player) {
             if (err) console.warn(err.message)
             console.log(player)
             })  */
            db.close()
        })
    })
}


function confirmMongo(phone) {
    MongoClient.connect('mongodb://127.0.0.1:3001/meteor', function (err, db) {
        var collection = db.collection('players')
        if (err) throw err
        collection.update({phone: phone}, {$set: {confirmed: true}}, {w: 1}, function (err) {
            if (err) console.warn(err.message)
            else console.log('successfully updated')
            db.close();
        })
    })
}

function mongoKill(name) {
    MongoClient.connect('mongodb://127.0.0.1:3001/meteor', function (err, db) {
        var collection = db.collection('players')
        if (err) throw err
        collection.update({name: name}, {$inc: {score: 1}}, {w: 1}, function (err) {
            if (err) console.warn(err.message)
            else console.log('successfully increased')
            db.close();
        })
    })
}

function getNameFromPhone(phone) {
    var name = null
    players.forEach(function (player) {
        if (player.phone == phone) {
            name = player.name
        }
    })
    return name
}

function getPhoneFromName(name) {
    var phone = null
    players.forEach(function (player) {
        if (player.name == name) {
            phone = player.phone
        }
    })
    return phone
}

function sendMessage(name, phone, key, replace) {
    var message = messages[key]
    if (arguments.length == 4) {
        message = message.replace('%replace%', replace)
    }
    var subject = key.replace('_', ' ')
    var options = getEmailOptions(name, subject, message)
    tryCarriers(options, name, phone)
}

function getEmailOptions(name, subject, message) {
    return {
        from: 'Assassin Game  <email@email.com>',
        to: 'stub',
        subject: 'Assassin Game: ' + subject,
        text: 'Hello ' + name + '. \n' + message
    }
}

// This only works in the US, Email->Phone
function tryCarriers(options, name, phone) {
    var carriers = ['txt.att.net', 'messaging.sprintpcs.com', 'tmomail.net', 'vtext.com']
    carriers.forEach(function (carrier) {
        options.to = name + '<' + phone + '@' + carrier + '>'
        sendEmail(options)
    })
}

//Send the actual email
function sendEmail(options) {
    transporter.sendMail(options, function (error, info) {
        if (error) {
            console.log(error)
        } else {
            console.log('Message sent: ' + info.response)
        }
    })
}

function shuffle(o) { //v1.0
    for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

checkArguments()