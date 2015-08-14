var ipc = require('ipc');
var fs = require('fs');

var container = document.getElementById("editor");
var hot = new Handsontable(container, {
  colHeaders: true,
  rowHeaders: true,
  columnSorting: true,
  contextMenu: false
});

container.addEventListener('contextmenu', function (e) {
  e.preventDefault();
  if (hot.getSelected()[0] == 0) {
    rowAbove.enabled = false
  }
  if (hot.getSelected()[1] == 0) {
    columnLeft.enabled = false
  }
  menu.popup(remote.getCurrentWindow());
  rowAbove.enabled = true
  columnLeft.enabled = true
}, false);

ipc.on('loadData', function(data) {
  csv = $.csv.toArrays(data);
  hot.loadData(csv);
  //refactorColumns(csv_2);
  fixRaggedRows(csv);
});

ipc.on('saveData', function(fileName) {
  data = hot.getData().map(function(d) { return d.join(",") }).join("\n")
  fs.writeFile(fileName, data, function (err) {
  });
  document.title = fileName;
});

ipc.on('validate', function() {
  validate();
});

// How to use:
// getValidation("Example,CSV,content\na,b,c\n")
//  .then(function(validation) {console.log(validation)})

function getValidation(content) {
  request = require('request');
  content = new Buffer(content).toString("base64");
  content = "editor.csv;data:text/csv;base64," + content;
  return new Promise(function(resolve, reject) {
    request.post("http://csvlint.io/package.json", { formData: {"files_data[]": content } }, function(error, response, body) {

      if (error) return reject(error);

      var packageURL = JSON.parse(response.body).package.url;
      var interval = setInterval(function() {
        request.get(packageURL + ".json", function(error, response, body) {
          try {
            var validationURL = JSON.parse(body).package.validations[0].url;
            clearInterval(interval);
            request.get(validationURL + ".json", function(error, response, body) {
              if (error) return reject(error);
              resolve(JSON.parse(body));
            });
          } catch(e) {}
        });
      }, 1000);

    });
  });
}

// Splits validation returned from CSVLint into errors, warnings and info messages

function validate() {
  data = hot.getData().map(function(d) { return d.join(",") }).join("\r\n")
  getValidation(data).then(function(json_validation) {
    errors = json_validation.validation.errors
    warnings = json_validation.validation.warnings
    info_messages = json_validation.validation.info
    console.error(errors)
    console.warn(warnings)
    console.info(info_messages);
  });
}

// Currently redundant unless the user refuses to fix ragged rows

function refactorColumns(csv_array) {
  col_add = getMaxColumns(csv_array) - hot.countCols()
  // adds a column by default if the amount parameter is 0, hence conditional
  if (col_add != 0) {
    hot.alter('insert_col', null, col_add)
  }
}

function getMaxColumns(csv_array) {
  max_columns = 0
  for (var i = 0; i < csv_array.length; i++) {
    col_length = csv_array[i].length
    if (col_length > max_columns) {
      max_columns = col_length
    }
  }
  return max_columns
}

// Fills undefined cells with an empty string, keeping the table in a
// rectangular format

function fixRaggedRows(csv_array) {
  ragged_rows = 0;
  //
  for (var y = 0; y < csv_array.length; y++) {
    for (var x = 0; x < getMaxColumns(csv_array); x++) {
      if (hot.getDataAtCell(y,x) === undefined || hot.getDataAtCell(y,x) === null) {
        if (ragged_rows == 0) {
          if (confirm("Your file has ragged rows, do you want to correct this?")) {
            ragged_rows = 1
            fixCell(csv_array,y,x)
          }
          else {ragged_rows = -1}
        }
        else if (ragged_rows == 1) {
          fixCell(csv_array,y,x)
        }
      }
    }
  }
  updateTable(csv_array)
}

function fixCell(csv_array,y,x) {
  csv_array[y].push("")
  console.log("Cell (" + String.fromCharCode(97 + x).toUpperCase() + "," + (y + 1) + ") has been added to file")
}

function updateTable(csv_array) {
  hot.updateSettings ({
    data: csv_array,
  });
}
