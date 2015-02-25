var SMTPServer = require('smtp-server').SMTPServer
var MailParser = require("mailparser").MailParser
var nodemailer = require('nodemailer')
var fs = require('fs')

// SMTP Server listener
var server = new SMTPServer({
   banner: 'Assassin',
   disabledCommands: ['AUTH'],
})

// SMTP Email Sender
var transporter = nodemailer.createTransport({
   service: 'Yandex',
   auth: {
      user: 'email@yandex.com',
      pass: 'password'
   }
})

// Options: run the server, generate 
// and send out targets, eliminate
var checkArguments = function() {
   var args = process.argv
   if (args.length <= 2) {
      console.log("Please provide an argument")
   } else {
      var arg = args[2]
      if (arg == "server") {
         server.listen(25)
      } else if (arg == "send") {
         sendTargets()
      } else if (arg == "eliminate") {
         if (args.length > 3) {
            var target = ""
            process.argv.forEach(function(val, index, array) {
               if (index >= 3) {
                  target += val
                  target += " "
               }
            });
            eliminatedTarget(target.trim())
         } else {
            console.log("Who would you like to eliminate?")
         }
      } else {
         console.log("Invalid arguements")
      }
   }
}

server.on('error', function(err) {
   console.log('Error occurred')
   console.log(err)
})

//I'll use this to get commands via email/text
server.onData = function(stream, session, callback) {
   console.log("Got a Message")
   var mailparser = new MailParser()
   mailparser.on("end", function(mailObject) {
      console.log(mailObject)
      console.log("From:", mailObject.from) //[{address:'sender@example.com',name:'Sender Name'}]
      console.log("Subject:", mailObject.subject) // Hello world!
      console.log("Text body:", mailObject.text) // How are you today?
      var parsed = mailObject.text //.split(/\n/) TODO parse.
      if (parsed.indexOf("COMMAND") > -1) {
         console.log("RECEIVED COMMAND")
      } else {
         console.log("NO COMMANDS D:")
      }
   })
   stream.pipe(mailparser)
   stream.on('end', callback)
}

//Generate targets from json, send out emails
var sendTargets = function() {
   var rawplayers = require('./players.json')
   var targets = []
   var next = 0
   var players = shuffle(rawplayers)
   players.forEach(function(player) {
      var name = player.name
      var phone = player.phone
      next++
      if (next == players.length) {
         next = 0
      }
      var target = players[next].name
      console.log("Player: " + name + " -- " + phone + " --> Target: " + target)
      targets.push({
            "name": name,
            "target": target
         })
         tryCarriers(name, target, phone)
   })
   writeTargets(targets)
}

var eliminatedTarget = function(sender) {
   var targets = require("./targets.json")
   var save = false
   targets.forEach(function(player) {
      var playername = player.name
      if (playername == sender) {
         var targetname = player.target
         console.log(playername + " killed " + targetname)
         targets.forEach(function(target) {
            if (target.name == targetname) {
               player.target = target.target
               target.target = "ELIMINATED"
               save = true
            }
         })
      }
   })
   if (save) {
      writeTargets(targets)
   }
}

// Write a pretty json file
var writeTargets = function(targets) {
   fs.writeFile("targets.json", JSON.stringify(targets, null, 2), function(err) {
      if (err) {
         console.log(err)
      } else {
         console.log("JSON file saved")
      }
   })
}
   //+ Jonas Raoni Soares Silva
   //@ http://jsfromhell.com/array/shuffle [v1.0]
function shuffle(o) { //v1.0
   for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
   return o;
};

// This only works in the US, Email->Phone
var tryCarriers = function(name, target, phone) {
   sendEmail(name, target, phone + '@txt.att.net')
   sendEmail(name, target, phone + '@messaging.sprintpcs.com')
   sendEmail(name, target, phone + '@tmomail.net')
   sendEmail(name, target, phone + '@vtext.com')
}

//Send the actual email
var sendEmail = function(name, target, email) {
   var mailOptions = {
      from: 'Assassin Game  <email@email.com>',
      to: name + '<' + email + '>',
      subject: 'Assassin Game: Your Target',
      text: 'Hello ' + name + '. \nYou have been assigned a target: ' + target + '.\nGood luck!'
   }

   transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
         console.log(error)
      } else {
         console.log('Message sent: ' + info.response)
      }
   })
}

checkArguments()