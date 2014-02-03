var logger = require("log4js").getLogger("auth"); 
var angoose = require("angoose"), mongoose = require("mongoose");
var authSchema = require("./permission-schema");

module.exports = {
    name: 'angoose-auth',
    postAuthorize: postAuth,
    preRedact: redact,
    //postPrepareSchema: schemaInterceptor,
    
    //preGenerateClient: moduleSetup,
    postSerializeModules: serializeModulesInterceptor
}
function postAuth(next, allowed){
   var ctx = angoose.getContext();
   var invocation = ctx.getInvocation();
   var user = ctx.getPrincipal() || {}; 
   logger.trace("in auth.postAuth. Allowed: ", allowed, "Method:", invocation.method);
   var allowed = isAllowed(invocation.clazz+"."+invocation.method)
   next(null, true);
};
// redaction
function redact(next){
    logger.trace("in auth.preRedact");
    next();
};
function isAllowed(action, roles){
    if(!roles){
        var p = angoose.getContext().getPrincipal();
        roles = p ? p.getRoles() : 'guest';
    }
    logger.trace("Checking ", roles, " for action", action);
    roles = Array.isArray(roles)? roles: [ roles ];
    for(var i=0;i<roles.length;i++){
        var m = matrix(roles[i]);
        if(m[action] === true ) return true;
    }
    return false;
}
function matrix(role){
    var data = {admin:{}, staff:{}};
    data.admin = {
        'MyService.allowedOp': true,
        'MyService.forbiddenOp': false
    } 
    return data[role] || {};
}

function schemaInterceptor(next,  schema){  // shouldn't the err argument be here? 
    //console.log("in post prepareSchema",schema);
    if(schema && (schema.methods || schema.statics) ){
        var methodNames = (schema.methods && Object.keys(schema.methods)) || [];
        methodNames.concat( (schema.statics && Object.keys(schema.statics)) || []);
        for(var i=0;methodNames && i<methodNames.length;i++){
           var mName = methodNames[i];  
           var path = schema.moduleName +"." + mName;
           var opts = {path: path, options:{type:'Boolean'} };
           authItems[path] = opts;  
        };
    };
    next(null, schema);  // we shouldn't need to provide the arguments here, bug in hooks module?
}
function serializeModulesInterceptor(next,  schemas){
    //console.log("in post serializeModulesInterceptor",schemas);
    logger.debug("in post serializeModules " );
    var clientSchema = new angoose.Schema();
    
    // get list of all published methods
    Object.keys(schemas).forEach(function(name){
        var schema = schemas[name];
        if(!schema) return;
        var methodNames =   Object.keys(schema.methods).concat(Object.keys(schema.statics));
        for(var i=0;methodNames && i<methodNames.length;i++){
           var mName = methodNames[i];
           var fn = schema.methods && schema.methods[mName];
           fn = fn || (schema.statics && schema.statics[mName]);
           if(angoose.Schema.typeOf(fn) != 'remote') continue; 
           var path = schema.moduleName +"." + mName;
           var field = {};
           field[path] = {type:Boolean, label:mName};
           authSchema.add(field);  
        };
    });
    
    angoose.module('PermissionModel', mongoose.model('PermissionModel', authSchema));
    
    var permModule = angoose.module('PermissionModel');
    var checker = false;
    clientSchema.prepareSchema('PermissionModel', permModule, function(err, pSchema){
        // this callback is guaranteed done synchorounsly
        schemas['PermissionModel'] = pSchema;
        checker = true;  
    });
    if(!checker) throw("prepareSchema extension did not return immediately");
    
    // dynamically generate permission model schema     
//     
//     
    // // fill schema, don't like this
    // if(schemas && schemas['AuthorizationModel']){
        // var schema = schemas['AuthorizationModel'];
        // console.log("Auth Schema",  schema);
        // var tmp = JSON.stringify(authItems);
        // tmp = tmp.replace(/^\s*\{(.*)}\s*$/, "$1");
        // schema = schema.replace(/"role":/,  tmp+', "role":');
        // schemas['AuthorizationModel'] = schema; 
    // }
    next(null, schemas);
}

function moduleSetup(next){
    //angoose.module('AuthorizationModel', mongoose.model('AuthorizationModel',authSchema ));
    next();    
} 