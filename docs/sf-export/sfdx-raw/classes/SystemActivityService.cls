/*
    Class Name: SystemActivityService
    Description: This class handles system activities.
    Created By: Vinitha R.
    **********************************************************************************************************************************
        Date            Modified By             Description     
    **********************************************************************************************************************************
        Oct-10-2025      VINITHA R.               Initial Development
    **********************************************************************************************************************************
*/
public inherited sharing class SystemActivityService{

    public static Task createSystemActivity(String subject, String description, Id relatedToId) {
    Task taskInstance = new Task();
    taskInstance.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SYSTEM_ACTIVITY);
    taskInstance.Subject = subject;
    taskInstance.Description = description;
    taskInstance.Status = 'Completed';
    if(LeadUtil.isLeadId(relatedToId) || ContactUtil.isContactId(relatedToId)){
        taskInstance.WhoId = relatedToId;
    }else if(OpportunityUtil.isOppId(relatedToId) || AccountUtil.isAccountId(relatedToId)){
        taskInstance.whatId = relatedToId;
    }
    return taskInstance;        
    }

    public static Task createSystemActivity(String subject, String description, Id relatedToId, String status) {
        Task taskInstance = new Task();
        taskInstance.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SYSTEM_ACTIVITY);
        taskInstance.Subject = subject;
        taskInstance.Description = description;
        taskInstance.Status = status;
        setRelatedToId(taskInstance, relatedToId);
        return taskInstance;
    }
    
    public static Task createSystemActivityWithTaskType(String subject, String description, Id relatedToId, String status, String taskType) {
        Task taskInstance = new Task();
        taskInstance.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SYSTEM_ACTIVITY);
        taskInstance.Subject = subject;
        taskInstance.Description = description;
        taskInstance.Status = status;
        taskInstance.Type = taskType;
        setRelatedToId(taskInstance, relatedToId);
        return taskInstance;
    }

    public static Task createSystemActivity(String subject, String description, Id relatedToId, String status, Id ownerId) {
        Task taskInstance = new Task();
        taskInstance.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SYSTEM_ACTIVITY);
        taskInstance.Subject = subject;
        taskInstance.Description = description;
        taskInstance.Status = status;
        taskInstance.OwnerId = ownerId;
        setRelatedToId(taskInstance, relatedToId);
        
        return taskInstance;
    }

    private static void setRelatedToId(Task taskInstance, Id relatedToId) {
        if (LeadUtil.isLeadId(relatedToId) || ContactUtil.isContactId(relatedToId)) {
            taskInstance.WhoId = relatedToId;
        } else if(OpportunityUtil.isOppId(relatedToId) || AccountUtil.isAccountId(relatedToId)) {
            taskInstance.whatId = relatedToId;
        }
    }
}