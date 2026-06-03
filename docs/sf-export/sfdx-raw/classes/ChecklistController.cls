public with sharing class ChecklistController {
    
    @AuraEnabled
    public static ApexActionResult getChecklistItems(Id parentSObjId) {
        final String SCOPE = 'ChecklistController.getChecklistItems';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ChecklistWrapper checklistWrap = new ChecklistWrapper();
            List<ChecklistItemWrapper> checklistItems = new List<ChecklistItemWrapper>();
            Id activeChecklistId;
            List<Checklist__c> activeChecklists = ChecklistData.getActiveChecklistItem(parentSObjId);
            if (activeChecklists != null && !activeChecklists.isEmpty()) {
                checklistWrap.checklistName = activeChecklists[0].Name;
                checklistWrap.checklistId = activeChecklists[0].Id;
                activeChecklistId = activeChecklists[0].Id;
            }
            Boolean isPerson = ApexUtil.isWhoId(parentSObjId);
            Integer completedCounter = 0;
            for (Task checklistItem : TaskData.getChecklistItems(parentSObjId, activeChecklistId, isPerson)) {
                ChecklistItemWrapper checklistItemWrap = constructChecklistItemWrapper(checklistItem);
                checklistItems.add(checklistItemWrap);
                if (checklistItem.Status == 'Completed') {
                    completedCounter++;
                }
            }
            checklistWrap.checklistItems = checklistItems;
            checklistWrap.completedChecklistItemsCount = completedCounter;
            result.data = JSON.serialize(checklistWrap);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult upsertchecklistItems(String checklistItemString) {
        final String SCOPE = 'ChecklistController.updateChecklistItems';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            List<ChecklistItemWrapper> checklistItemsWrapList = (List<ChecklistItemWrapper>)JSON.deserialize(checklistItemString, List<ChecklistItemWrapper>.class);
            List<Task> tasksList = convertCheckListItemWrapsToTasks(checklistItemsWrapList);
            if (tasksList != null && !tasksList.isEmpty()) {
                for (Task taskRec : tasksList) {
                    if (taskRec.Id == null) {
                        taskRec.RecordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
                    }
                }
            }
            upsert tasksList;
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    private static List<Task> convertCheckListItemWrapsToTasks(List<ChecklistItemWrapper> checklistItemsWrapList) {
        List<Task> tasksList = new List<Task>();
        for (ChecklistItemWrapper checklistItemWrap : checklistItemsWrapList) {
            Task taskRecord = new Task();
            taskRecord.Id = checklistItemWrap.taskId;
            taskRecord.Subject = checklistItemWrap.subject;
            taskRecord.ActivityDate = checklistItemWrap.dueDate;
            taskRecord.Status = checklistItemWrap.status;
            taskRecord.Description = checklistItemWrap.comments;
            taskRecord.Checklist__c = checklistItemWrap.parentChecklistId;
            taskRecord.WhatId = checklistItemWrap.relatedToId;
            taskRecord.priority = checklistItemWrap.priority;

            if (taskRecord.Id != null) {
                taskRecord.OwnerId = checklistItemWrap.assignedToId;
            }
            tasksList.add(taskRecord);
        }
        return tasksList;
    }

    private static ChecklistItemWrapper constructChecklistItemWrapper(Task taskSObj) {
        ChecklistItemWrapper checklistItemWrap = new ChecklistItemWrapper();
        checklistItemWrap.taskId = taskSObj.Id;
        checklistItemWrap.subject = taskSObj.Subject;
        checklistItemWrap.dueDate = taskSObj.ActivityDate;
        checklistItemWrap.status = taskSObj.Status;
        checklistItemWrap.comments = taskSObj.Description;
        checklistItemWrap.parentChecklistId = taskSObj.Checklist__c;
        checklistItemWrap.relatedToId = taskSObj.WhatId;
        checklistItemWrap.assignedTo = taskSObj.Owner.Name;
        checklistItemWrap.assignedToId = taskSObj.OwnerId;
        checklistItemWrap.priority = taskSObj.Priority;
        return checklistItemWrap;
    }

    public class ChecklistWrapper {
        public String checklistName;
        public String checklistId;
        public List<ChecklistItemWrapper> checklistItems;
        public Integer completedChecklistItemsCount;
    }

    public class ChecklistItemWrapper {
        public Id parentChecklistId;
        public Id relatedToId;
        public Id taskId;
        public String subject;
        public String status;
        public Date dueDate;
        public String assignedTo;
        public String assignedToId;
        public String comments;
         public String priority;
    }
}