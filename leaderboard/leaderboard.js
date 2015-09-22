Players = new Mongo.Collection("players")

if (Meteor.isClient) {
    Template.leaderboard.helpers({
        players: function () {
            return Players.find({}, {
                sort: {
                    score: -1,
                    name: 1
                }
            })
        },
        selectedName: function () {
            var player = Players.findOne(Session.get("selectedPlayer"))
            return player && player.name
        }
    })

    Template.player.helpers({
        selected: function () {
            return Session.equals("selectedPlayer", this._id) ? "selected" : ''
        }
    })

    Template.player.events({
        'click': function () {
            Session.set("selectedPlayer", this._id)
        }
    })

    Template.register.events({
        'submit form': function (event) {
            event.preventDefault()
            var first = event.target.firstname.value
            var last = event.target.lastname.value
            var phone = event.target.phone.value
            var parsephone = phone.replace(/\D/g, '')
            if (first != "" && last != "" && parsephone != "") {
                var name = first.charAt(0).toUpperCase() + first.slice(1) + ' ' + last.charAt(0).toUpperCase() + last.slice(1)
                if (parsephone.length == 10) {
                    if (Players.find({
                            name: name
                        }).count() == 0 && Players.find({
                            phone: parsephone
                        }).count() == 0) {
                        Players.insert({
                            name: name,
                            score: 0,
                            phone: parsephone,
                            confirmed: false
                        })
                        $('#register').modal('hide')
                    } else {
                        event.target.phone.value = "You already registered!"
                    }
                } else {
                    event.target.phone.value = "Phone number should be 10 digits"
                }
            }
            Meteor.call('sendEmail', name, phone)
        }
    })
}

// On server startup, create some players if the database is empty.
if (Meteor.isServer) {
    Meteor.startup(function () {
        if (Players.find().count() === 0) {
            var names = ["Name Test", "Another Name"]
            _.each(names, function (name) {
                Players.insert({
                    name: name,
                    score: 0,
                    phone: "1234567890",
                    confirmed: false
                })
            })
        }
    })

    Meteor.methods({
        sendEmail: function (name, phone) {
            var nodemailer = Nodemailer;
            var transporter = nodemailer.createTransport({
                service: 'Yandex',
                auth: {
                    user: 'email@email.com',
                    pass: 'password'
                }
            })
            var carriers = ['txt.att.net', 'messaging.sprintpcs.com', 'tmomail.net', 'vtext.com']
            carriers.forEach(function (carrier) {
                var email = name + '<' + phone + '@' + carrier + '>'
                var options = {
                    from: 'Assassin Game  <email@email.com>',
                    to: email,
                    subject: 'Assassin Game: Confirm',
                    text: 'Hello ' + name + '\nPlease confirm your registration by replying:\n \'CONFIRM\''
                }
                transporter.sendMail(options, function (error, info) {
                    if (error) {
                        console.log(error)
                    } else {
                        console.log('Message sent: ' + info.response)
                    }
                })
            })
        }
    })
}