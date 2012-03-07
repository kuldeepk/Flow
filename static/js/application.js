var isCntrl = false;
var isShift = false;
var isAlt = false;
var newTask = "<div class='task'><div class='bullet'></div><textarea class='editable'></textarea><div class='reset'></div></div>";

$(document).ready(function(){
	$("#todos .editable").live("keydown", catchKey);
	$("#todos .editable").live("keyup", function(event){
		reporter.updateTask($(this).parent().attr("taskid"), $(this).val());
		if(event.keyCode == 16) /* SHIFT */
			isShift = false;
		if(event.keyCode == 17) /* CNTRL */
			isCntrl = false;
		if(event.keyCode == 18) /* ALT */
			isAlt = false;
	});
	window.setTimeout(updater.poll, 0);
	setInterval("reporter.sendMessage();", 200);
});

function catchKey(event){
	var parent = $(this).parent();
	if(event.keyCode == 16) /* SHIFT */
		isShift = true;
	if(event.keyCode == 17) /* CNTRL */
		isCntrl = true;
	if(event.keyCode == 18) /* ALT */
		isAlt = true;
		
	if (event.keyCode == 13) { /* ENTER */
		var new_task_id = Math.floor(Math.random()*1000);
		var temp = $(newTask).attr('taskid', new_task_id);
		var prevStep = parent.attr("step");
		if(!prevStep)
			prevStep = 0;
		temp.attr('step', prevStep);
		temp.css("margin-left", (prevStep*30)+"px");
		var pos = getCaretPosition(this);
		var taskStringOrg = $(this).val().substring(0, pos);
		var taskStringNew = $(this).val().substring(pos, $(this).val().length);
		$(this).val(taskStringOrg)
		temp.insertAfter(parent);
		parent.next().children().val(taskStringNew);
		setCaretPosition(parent.next().children("textarea")[0], 0);
		reporter.newTask(new_task_id, taskStringNew, parent.attr("taskid"), prevStep);
		reporter.updateTask(parent.attr("taskid"),taskStringOrg);
		return false;
	}
	else
		if(event.keyCode == 8 && $(this).val()==""){ /* BACKSPACE with empty string */
			if (parent.prev().hasClass('task')) {
				parent.prev().children("textarea").focus();
				reporter.deleteTask(parent.attr("taskid"));
				parent.remove();
			}
			else 
				if (parent.next().hasClass('task')) {
					parent.next().children("textarea").focus();
					reporter.deleteTask(parent.attr("taskid"));
					parent.remove();
				}
			return false;
		}
	else
		if(event.keyCode == 8 && getCaretPosition(this)==0){ /* BACKSPACE at pos 0 */
			if (parent.prev().hasClass('task')) {
				var taskStringOrg = $(this).val();
				var taskStringNew = $(this).parent().prev().children("textarea").val();
				parent.prev().children("textarea").val(taskStringNew + taskStringOrg)
				setCaretPosition(parent.prev().children("textarea")[0], taskStringNew.length);
				reporter.deleteTask(parent.attr("taskid"));
				reporter.updateTask(parent.prev().attr("taskid"), taskStringNew + taskStringOrg);
				parent.remove();
			}
			return false;
		}
	else
		if (event.keyCode == 46 && getCaretPosition(this) == $(this).val().length) { /* DELETE at end */
			if (parent.next().hasClass('task')) {
				var taskStringOrg = $(this).val();
				var taskStringNew = parent.next().children("textarea").val();
				$(this).val(taskStringOrg + taskStringNew)
				setCaretPosition(this, taskStringOrg.length);
				reporter.deleteTask(parent.next().attr("taskid"));
				reporter.updateTask(parent.attr("taskid"), taskStringOrg + taskStringNew);
				parent.next().remove();
			}
			return false;
		}
	else 
		if (event.keyCode == 38) { /* ARROW UP */
			parent.prev().children("textarea").focus();
			//setCaretPosition($(this).parent().prev().children("textarea")[0], getCaretPosition(this));
			return false;
		}
	else 
		if (event.keyCode == 40) { /* ARROW DOWN */
			parent.next().children("textarea").focus();
			return false;
		}
	else 
		if (event.keyCode == 9 && isShift==true) { /* SHIFT + TAB */
			shifting.tabOut(parent);
			reporter.shiftTask(parent.attr('taskid'), "tab_out");
			return false;
		}
	else 
		if (event.keyCode == 9) { /* TAB */
			shifting.tabIn(parent);
			reporter.shiftTask(parent.attr('taskid'), "tab_in");
			return false;
		}
	//alert(event.keyCode);
}

var shifting = {
	tabIn: function(curElem){
		if (!curElem.prev().hasClass('task'))
			return false;
		var curStep = curElem.attr("step");
		var prevStep = curElem.prev().attr("step");
		if(!curStep)
			curStep = 0;
		if(!prevStep)
			prevStep = 0;		
		if (curStep <= prevStep) {
			curStep++;
			curElem.attr("step", curStep);
			curElem.css("margin-left", (curStep*30)+"px");
			curElem.nextAll('.task').each(function(index, elem){
				if($(elem).attr("step") > (curStep-1)){
					var thisStep = $(elem).attr("step");
					thisStep++;
					$(elem).attr("step", thisStep);
					$(elem).css("margin-left", (thisStep*30)+"px");
				} else
					return false;
			});
		}
	},
	
	tabOut: function(curElem){
		var curStep = curElem.attr("step");
		curStep--;
		if(curStep < 0)
			curStep = 0;
		curElem.attr("step", curStep);
		curElem.css("margin-left", (curStep*30)+"px");
		curElem.nextAll('.task').each(function(index, elem){
			if($(elem).attr("step") > (curStep+1)){
				var thisStep = $(elem).attr("step");
				thisStep--;
				$(elem).attr("step", thisStep);
				$(elem).css("margin-left", (thisStep*30)+"px");
			} else
				return false;
		});
	}
}

var reporter = {
	queue: new Queue(),
	lastCallTime: null,
	timeGap: 500,
	
	sendMessage: function() {
		var data = reporter.queue.dequeue();
		if (data) {
			if(data.action == 'new'){
				$.postJSON("/task/new", {
					'body': $("#todos .task[taskid="+data.task_id+"] textarea").val(),
					'taskid': data.task_id,
					'after_task': data.after_task,
					'step': data.step
				});				
			} else if(data.action == 'update'){
				$.postJSON("/task/update", {
					'body': $("#todos .task[taskid="+data.task_id+"] textarea").val(),
					'taskid': data.task_id
				});				
			} else if(data.action == 'delete'){
				$.postJSON("/task/delete", {
					'taskid': data.task_id
				});				
			} else if(data.action == 'shift'){
				$.postJSON("/task/shift", {
					'taskid': data.task_id,
					'shift_to': data.shift_to
				});				
			} 
		}
	},	
	
	newTask: function (task_id, task_text, after_task, step) {
		var data = { action: 'new', task_id: task_id, after_task: after_task, step: step };
		reporter.queue.enqueue(data);
	},
	
	updateTask: function (task_id, task_text) {
		var data = { action: 'update', task_id: task_id };
		reporter.queue.enqueue(data);
	},
	
	deleteTask: function (task_id) {
		var data = { action: 'delete', task_id: task_id };
		reporter.queue.enqueue(data);
	},
	
	shiftTask: function(task_id, shift_to){
		var data = { action: 'shift', task_id: task_id, shift_to: shift_to };
		reporter.queue.enqueue(data);
	}
}

var updater = {
    errorSleepTime: 500,
    cursor: null,

    poll: function() {
        var args = {"user_id": getCookie("user")};
		if (updater.cursor) args.cursor = updater.cursor;
        $.ajax({url: "/task/updates", type: "POST", dataType: "json",
                data: $.param(args), success: updater.onSuccess,
                error: updater.onError});
    },

    onSuccess: function(response) {
		if(response.action == 'new_task')
			updater.newTask(response)
		if(response.action == 'update_task')
			updater.updateTask(response)
		if(response.action == 'delete_task')
			updater.deleteTask(response)
		if(response.action == 'shift_task')
			updater.shiftTask(response)
        updater.errorSleepTime = 500;
        window.setTimeout(updater.poll, 0);
    },

    onError: function(response) {
        updater.errorSleepTime *= 2;
        console.log("Poll error; sleeping for", updater.errorSleepTime, "ms");
        window.setTimeout(updater.poll, updater.errorSleepTime);
    },

    newTask: function(response) {
		var temp = $(newTask).attr('taskid', response.task_id);
		temp.children("textarea").val(response.task_text);
		temp.attr('step', response.step);
		temp.css("margin-left", (response.step*30)+"px");
		temp.insertAfter("#todos .task[taskid="+response.after_task+"]");
    },
	
	updateTask: function(response) {
        $("#todos .task[taskid="+response.task_id+"] textarea").val(response.task_text);
    },
	
	deleteTask: function(response) {
        $("#todos .task[taskid="+response.task_id+"]").remove();
    },
	
	shiftTask: function(response) {
		if(response.shift_to == 'tab_in')
        	shifting.tabIn($("#todos .task[taskid="+response.task_id+"]"));
		if(response.shift_to == 'tab_out')
        	shifting.tabOut($("#todos .task[taskid="+response.task_id+"]"));
    }
};

function setSelectionRange(input, selectionStart, selectionEnd) {
  if (input.setSelectionRange) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  }
  else if (input.createTextRange) {
    var range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', selectionEnd);
    range.moveStart('character', selectionStart);
    range.select();
  }
}

function setCaretPosition(input, pos) {
  setSelectionRange(input, pos, pos);
}

function getCaretPosition (ctrl) {
	var CaretPos = 0;	// IE Support
	if (document.selection) {
	ctrl.focus ();
		var Sel = document.selection.createRange ();
		Sel.moveStart ('character', -ctrl.value.length);
		CaretPos = Sel.text.length;
	}
	// Firefox support
	else if (ctrl.selectionStart || ctrl.selectionStart == '0')
		CaretPos = ctrl.selectionStart;
	return (CaretPos);
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}

jQuery.postJSON = function(url, args, callback) {
    args.user_id = getCookie("user");
    $.ajax({url: url, data: $.param(args), dataType: "text", type: "POST",
            success: function(response) {
        if (callback) callback(eval("(" + response + ")"));
    }, error: function(response) {
        console.log("ERROR:", response)
    }});
};