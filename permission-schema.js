var mongoose  = require('mongoose');

var schema = new mongoose.Schema({
     role: {type:String, label:'Role', required:true, tags:['default-list']}
}, {collection:'auth_roles'});
 
module.exports =  schema;



