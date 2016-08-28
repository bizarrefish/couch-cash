function parseRBSDate(text) {
	var parts = text.split("/");
	return Date.parse(parts[2] + "-" + parts[1] + "-" + parts[0]);
}

function loadRBS(text) {
	var ret = [];

	var lines = text.split("\n");
	
	$.each(lines, function(index, line) {
		if(index < 3)
			return;
		
		if(line.indexOf('"') != -1) {
			// No quotes in reference
		
			var beforeRef = line.replace(/",.*$/,'');
			var beforeParts = beforeRef.split(',');
			var time = parseRBSDate(beforeParts[0]);
			var ref = line.replace(/^.*,"'/,'').replace(/",.*$/,'');
			var afterRef = line.replace(/.*",/,'');
			var afterParts = afterRef.split(',');
			var value = Number(afterParts[0]);
			var balance = Number(afterParts[1]);

		} else {
			// Quotes in reference
			
			var parts = line.split(",");
			var time = parseRBSDate(parts[0]);
			var ref = parts[2].substring(1);
			var value = Number(parts[3]);
			var balance = Number(parts[4]);
		}
				
		var obj = {};
		obj.time = time;
		obj.ref = ref;
		obj.balance = balance;
		obj.debit = 0;
		obj.credit = 0;
		if(value >= 0) {
			obj.credit = value;
		} else {
			obj.debit = -value;
		}
		ret.push(obj);
	
	});
	
	return ret;
}
