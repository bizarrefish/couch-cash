
// Load the Visualization API and the corechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(function() {
	$(document).ready(function() {
		ko.applyBindings(new TopLevelViewModel());
	});
});


function LoginViewModel() {
	var self = this;
	this.username = ko.observable("admin")
	this.password = ko.observable("")
	this.database = ko.observable("money")
	
	this.databaseConnection = ko.observable(null);
	this.doLogin = function() {
		// Set databaseConnection non-null
		self.databaseConnection(new DatabaseConnection(self.username(), self.password(), self.database()))
	}
}

function CategoryViewModel(conn) {
	var self = this;
	
	this.expandedIndex = ko.observable(null);

	this.categoryList = ko.observableArray([]);
	
	function mapCategoryObject(plain) {
		var mapped = ko.mapping.fromJS(plain);
		// Subscribe to changes
		mapped.enabled = ko.observable(true);
		mapped.test.subscribe(function() { self.edited(true); });
		return mapped;
	}
	
	function fetchCategoryList(overwrite) {
		conn.getCategories().done(function(cats) {
			if(overwrite) self.categoryList($.map(cats, mapCategoryObject));
			self.edited(false);
		});
	}
	
	this.edited = ko.observable(false);
	
	this.saveCategories = function() {
		//self.expandedIndex(null);
		
		var newCats = $.map(self.categoryList(), function(c) {
			return { name: c.name(), test: c.test() }
		});
		
		conn.setCategories(newCats).done(function() {
			fetchCategoryList(false);
		});
		
		self.categoryList.valueHasMutated();
	}
	
	
	this.deleteExpandedCategory = function() {
		var idx = self.expandedIndex();
		self.categoryList.remove(self.categoryList()[idx]);
		self.edited(true);
	}
	
	this.newCategoryName = ko.observable("");
	
	this.newCategory = function() {
		self.categoryList.push(mapCategoryObject({
			name: self.newCategoryName(),
			test: "CONTAINS('" + self.newCategoryName() + "')"
		}));
		self.expandedIndex(self.categoryList.length-1);
		self.edited(true);
	}
	
	fetchCategoryList(true);
}


function PieViewModel(conn, categoryListObs, statementList) {
	var self = this;
	
	this.statementList = statementList;
	
	this.selectedStatement = ko.observable(null);
	
	this.showOthers = ko.observable(false);
	
	this.breakdown = ko.computed(function() {
	
		var showOthers = self.showOthers();
		if(self.selectedStatement() == null) {
			return $.when({});
		}
	
		var catList = categoryListObs();
		
		var catMap = {};
		$.each(catList, function(i, cat) {
			if(cat.enabled() == true) catMap[cat.name()] = cat.test.peek();		// We don't want updates in test to make us refresh everything, so we use peek()
		});
		
		return conn.getDocument(self.selectedStatement()).then(function(doc) {
			// Crunch data:
			var result = categorize(doc.transactions, catMap)
			
			if(!showOthers) {
				delete result._others;
			}
			return result;
		});
		
	}).extend({async: {}});
	
	this.selectedCategory = ko.observable("");
	
	this.transactionList = ko.computed(function() {
		return self.breakdown()[self.selectedCategory()];
	});
	

	var sel = $('#pieDiv');
	var data = null;

	sel.ready(function() {
		var chart = new google.visualization.PieChart(document.getElementById('pieDiv'));
					
		var fmt = new google.visualization.NumberFormat({ prefix:"\u00A3", fractionDigits: 2});
		google.visualization.events.addListener(chart, 'select', function() {
			var item = chart.getSelection()[0];
			if(item && data) {	
				var cat = data.getValue(item.row, 0);
				self.selectedCategory(cat);
			}
		});
		
		
		self.breakdown.subscribe(function(bd) {
			data = new google.visualization.DataTable();
			data.addColumn('string', "Category");
			data.addColumn('number', "Total Spent")
			$.each(bd, function(cat, list) {
				var total = 0;
				$.each(list, function(idx, tx) {
					if(tx.debit) total += tx.debit;
				});
				data.addRow([cat, total]);
			});
			fmt.format(data, 1);
		
			var options = {title:'Spending Pie', is3D: true, pieSliceText: "value", width: sel.width(), height:500};
			chart.draw(data, options);

			
		});

	});
}

function LoadStatementViewModel(conn, reloadStatements){
	var self = this;
	
	this.statementText = ko.observable("");
	
	this.loadMode = ko.observable("RBS");
	
	this.loadStatement = function() {
		var transactions = [];
		switch(self.loadMode()) {
		case "HSBC":
			break;
			
		case "RBS":
			transactions = loadRBS(self.statementText());
			break;
		}
		
		// month -> [tx,tx,..]
		var txMap = {};
		
		$.each(transactions, function(idx, tx) {
			var date = new Date(tx.time);
			var key = date.getFullYear() + "-" + (date.getMonth() + 1);
			
			if(!txMap.hasOwnProperty(key))
				txMap[key] = [];
				
			txMap[key].push(tx);
		});
		
		function makeTxKey(a) {
			return a.time + "," + a.ref + "," + a.balance + "," + a.credit + "," + a.debit;
		}
		
		var reqs = $.map(txMap, function(txList, key) {
			var docId = "Statement-" + key
			
			return conn.getDocument(docId).then(function(oldDoc) {
				// Must merge with an old document
				
				var mergedTxMap = {};
				// Add the old transactions
				$.each(oldDoc.transactions,function(i,tx) { mergedTxMap[makeTxKey(tx)] = tx; })
				
				// Add the new transactions
				$.each(txList,function(i,tx) { mergedTxMap[makeTxKey(tx)] = tx; })
				
				// Rebuild the array
				txList = [];
				$.each(mergedTxMap,function(i,tx) { txList.push(tx); })
				
				return conn.putNewDocument(docId, { _rev: oldDoc._rev, transactions: txList });
			}, function() {
				// no old document; just store
				return conn.putNewDocument(docId, { transactions: txList });
			});
		})
		
		$.when.apply($, reqs).done(function() {
			reloadStatements();
		});
	};
}


function TopLevelViewModel() {
	var self = this;
	this.login = new LoginViewModel();
	
	
	this.connection = this.login.databaseConnection;
	
	this.connected = ko.computed(function() {
		return self.connection() != null;
	});
	
	this.statementList = ko.observable([]);
	
	// This is populated on connection
	this.viewContainer = ko.computed(function() {
		var conn = self.connection();
		
		if(conn != null && self.viewContainer.peek() == null) {
		
			function reloadStatements() {
				conn.getStatements().done(function(result) {
					self.statementList(result);
				});
			}
	
			reloadStatements();
		
			var catView = new CategoryViewModel(conn);
			var pieView = new PieViewModel(conn, catView.categoryList, self.statementList);
			var loadView = new LoadStatementViewModel(conn, reloadStatements);
			return {
				categoryView: catView,
				pieView: pieView,
				loadView: loadView
			};
		} else {
			return null;
		}
	});
	


}



// Categorize an array of items
//
// items: [item,item,...]
// categories: { catname: function(item), ... }
//
// returns { "catname|catname|...": [item,item,... ], ..., "_others": [item,item,...] }
function categorize(items, categories) {
	var result = {};
	var others = [];
	
	// Evaluate strings to functions if necessary
	categories = $.extend(false, {}, categories);
	for(var cat in categories) {
		var fn = categories[cat];
		if(fn.constructor === String) {
			try {
				categories[cat] = eval(fn);
			} catch(e) {
				console.log(e);
			}
		}
	}
	
	for(var i in items) {
		var itm = items[i];
		
		var categorySet = {};
		for(var cat in categories) {
			var fn = categories[cat];
			try {
				if(fn(itm)) {
					categorySet[cat] = null;
				}
			} catch(e) {
				console.log(e);
			}
		}

		var cats = Object.keys(categorySet);
		var catKey = cats.length == 0 ? "_others" : cats.sort().join("|");
		
		if(!result[catKey])
			result[catKey] = [];
	
		result[catKey].push(itm);
	}
	
	return result;
}
