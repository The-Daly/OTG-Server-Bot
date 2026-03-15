const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`OTG Bot online as ${client.user.tag}`);
    client.user.setActivity('/trade | OTG Academy');
  },
};
