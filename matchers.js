function REGEX(reg) {
	return function(tx) { return true; };
}

function CONTAINS(word) {
	return function(tx) { return tx.ref.indexOf(word) != -1; }
}

function OR() {
	var args = arguments;
	return function(tx) {
		for(var i in args) {
			if(args[i](tx) == true) {
				return true;
			}
		}
		return false;
	};
}
