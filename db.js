
function DatabaseConnection(username, password, database) {
	this.doRequest = function(method, id, data) {
		return $.ajax({
			url: "http://" + location.host + ":5984/" + database + "/" + id,
			type: method,
			dataType: "json",
			contentType: "json",
			data: JSON.stringify(data),
			beforeSend: function (xhr) {
		    	xhr.setRequestHeader ("Authorization", "Basic " + btoa(username + ":" + password));
			}
		})
	}
	this.categoriesRev = null;
}

DatabaseConnection.prototype.getCategories = function() {
	var self = this;
	return this.getDocument("Categories").then(function(doc) {
		self.categoriesRev = doc._rev;
		return doc.categories;
	},function() {
		return self.putNewDocument("Categories", { _id: "Categories", categories: [] }).then(function(doc) {
			self.categoriesRev = doc._rev;
			return [];
		});
	});
}

DatabaseConnection.JUST = function(value) {
	var df = $.Deferred();
	df.resolve(value);
	return df;
}

DatabaseConnection.prototype.setCategories = function(cats) {
	var self = this;
	return (self.categoriesRev == null ? self.getCategories() : DatabaseConnection.JUST(null)).then(function() {
		return self.doRequest("PUT", "Categories", {
			"_id": "Categories",
			"_rev": self.categoriesRev,
			"categories": cats
		});
	});
}

DatabaseConnection.prototype.getStatements = function() {
	var self = this;
	return this.doRequest("GET", "_all_docs").then(function(docList) {
		return $.grep(
			$.map(docList.rows, function(row) { return row.id; }),
			function(id) { return id.startsWith("Statement-"); });
	});
}

DatabaseConnection.prototype.getDocument = function(id) {
	return this.doRequest("GET", id);
}


DatabaseConnection.prototype.putNewDocument = function(id, data) {
	data._id = id;
	return this.doRequest("PUT", id, data);
}


