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
		
		var inQuotes = false;
		var skip = false;
		
		var fields = [""];
		for(var i in line) {
			var c = line[i];
			
			if(skip) {
				skip = false;
				continue;
			}
			
			switch(c) {
			case "\"":
				inQuotes = !inQuotes;
				if(inQuotes) {
					skip = true;
				}
				break;
				
			case ",":
				if(inQuotes) {
					fields[fields.length-1] = fields[fields.length-1] + c;
				} else {
					fields.push("");
				}
				break;
				
			default:
				fields[fields.length-1] = fields[fields.length-1] + c;
				break;
			}
		}
		
		var time = parseRBSDate(fields[0]);
		var ref = fields[2];
		var balance = Number(fields[4]);
		var value = Number(fields[3]);
		
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
