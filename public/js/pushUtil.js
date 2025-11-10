// Provide safe no-op handlers if push code is not fully wired yet.
window.pushAllow = window.pushAllow || function(){ console.log('pushAllow noop'); };
window.pushDeny  = window.pushDeny  || function(){ console.log('pushDeny noop'); };
