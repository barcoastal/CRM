public inherited sharing class TaskData {

    public static List<Task> queryTasksForInboundSMS(Set<Id> taskIds) {
        return [SELECT Id, Subject, Parent_SMS__r.Is_Inbound__c, Parent_SMS__r.From_Phone__c,
            Parent_SMS__r.To_Phone__c, Parent_SMS__r.Message_Body__c, whoId, WhatId, User_to_Notify__c 
            FROM Task WHERE Id IN :taskIds AND Parent_SMS__r.Is_Inbound__c = true];
    }

    public static List<Task> getChecklistItems(Id parentSObjId, Id checklistId, Boolean isPerson) {
        Id recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        String query = 'SELECT Id, Subject, ActivityDate, Status, Owner.Name, OwnerId , Priority, Description, Checklist__c, WhatId FROM Task';
        query += ' WHERE RecordTypeId = :recordTypeId AND ';
        query += isPerson ? ' WhoId = :parentSObjId' : ' WhatId = :parentSObjId';
        return Database.query(query);
    }

    public static List<Task> getChecklistItemsOfPerson(Id parentSObjId) {
        Id recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        return [SELECT Id, Subject, ActivityDate, Status, Owner.Name, Description FROM Task WHERE RecordTypeId = :recordTypeId AND WhoId = :parentSObjId];
    }
    
     public static List<Task> queryOpenTasks(Set<Id> accountIds) {
        return [SELECT Id, Subject, Status, Parent_SMS__r.Is_Inbound__c, Parent_SMS__r.From_Phone__c,
            Parent_SMS__r.To_Phone__c, Parent_SMS__r.Message_Body__c, whoId, WhatId, User_to_Notify__c 
            FROM Task WHERE WhatId IN :accountIds AND Status !=: TaskUtil.COMPLETED_STATUS];
    }
    public static List<Task> queryWelcomeCallCompletedTasks(Id accountId) {
        return [SELECT Id, Subject,Status, whoId, WhatId, User_to_Notify__c 
                FROM Task WHERE WhatId =: accountId AND Status =: TaskUtil.COMPLETED_STATUS AND Subject LIKE '%Welcome Call Completed%'];
    }
}