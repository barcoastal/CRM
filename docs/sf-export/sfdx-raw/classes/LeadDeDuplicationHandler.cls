public without sharing class LeadDeDuplicationHandler {

    private static final String SCOPE = 'Web Lead De-duplication Check';
    private static final String TASK_DESC_NO_PHONE = 'Lead de-duplication skipped as phone number is missing';
    private static final String TASK_DESC_ACTIVE_OPP = 'Lead is archived as an active opportunity exists with the same phone number';
    private static final String TASK_DESC_NEW_LEAD = 'Lead is archived as a new web lead comes with the same phone number';
    private static final String TASK_DESC_DEDUPE_DONE = 'Lead DeDuplication is done. No Duplicate records found with this lead\'s phone number in the system.';
    private static final String TASK_DESC_DEDUPE_COMPLETED = 'Lead DeDuplication is done. No Active Leads and Opportunities are there for this lead in the system.';
    private static final String TASK_DESC_ACTIVE_OPP_OWNER = 'Notification: The client of this active opportunity signed in as web lead in our system and got archived.';
    private static final String TASK_DESC_CALL_TO_CLIENT = 'Call: Please reach out to the client as they have signed in as a new web lead in our system.';

     // New constants for archived opportunity reshuffling
    private static final String TASK_DESC_RESHUFFLED_OPP_ARCHIVED = 'Opportunity is archived as the client re-engaged by signing in as a new web lead.';
    private static final String TASK_DESC_RESHUFFLED_OPP_OWNER = 'Notification: The client of this reshuffled opportunity re-engaged by signing in as a new web lead and the opportunity has been archived.';
    
    private static final String LEAD_STATUS_ARCHIVE = 'Archive Disposition';
    private static final String LEAD_STATUS_SUB_DISPO_ACTIVE_LEAD_EXISTS = 'Archived - Duplicate Lead';
    private static final String LEAD_STATUS_SUB_DISPO_ACTIVE_OPP_EXISTS = 'Archived - Duplicate Lead';
    
     // Notification and Email constants
    private static final String NOTIFICATION_TITLE = 'New duplicate Web Lead Created';
    private static final String NOTIFICATION_BODY = 'The active client has signed in as a web lead. Please reach out immediately.';

    private static Map<Id, NotificationData> notificationsToSend = new Map<Id, NotificationData>();

    private static Set<Id> inputLeadIds = new Set<Id>();
    private static List<Lead> leadsToUpdateList = new List<Lead>();
    private static List<Opportunity> oppToUpdateList = new List<Opportunity>();
    private static List<Task> tasksToCreateList = new List<Task>();
    private static Set<String> unProcessedPhoneSet = new Set<String>();
    private static Set<Id> leadIdsToProcess = new Set<Id>();
    
    //Leads with "Web" lead source category should be passed to this method.
    public static void deduplicateLeads(Set<Id> leadIds) {
        
        if (isDeduplicationDisabled()) {
            return;
        }
        
        if (leadIds != null && !leadIds.isEmpty()) {
            inputLeadIds = leadIds;
            Map<String, Lead> phoneNumberToLeadMap = new Map<String, Lead>();
            for (Lead leadRecord : LeadData.queryLeadsByIds(leadIds)) {
                if (String.isBlank(leadRecord.Formated_Phone__c)) {
                    Task task = SystemActivityService.createSystemActivity(SCOPE, TASK_DESC_NO_PHONE, leadRecord.Id, TaskUtil.TASK_STATUS_FAILED);
                    tasksToCreateList.add(task);
                } else {
                    phoneNumberToLeadMap.put(leadRecord.Formated_Phone__c, leadRecord);
                    unProcessedPhoneSet.add(leadRecord.Formated_Phone__c);
                    leadIdsToProcess.add(leadRecord.Id);
                }
            }
            checkOpportunities(phoneNumberToLeadMap);
            checkInactiveReshuffledOpportunities(phoneNumberToLeadMap);
            checkLeads(phoneNumberToLeadMap);
            processNewLeads(leadIdsToProcess);
            OpportunityTriggerHandler.bypassForDeDuplication = true;
            DMLService.performUpdateDML(oppToUpdateList, SCOPE);
            oppToUpdateList.clear();
               OpportunityTriggerHandler.bypassForDeDuplication = false; LeadTriggerHandler.runPopulateArchivedDateAndIsArchivedCheckboxInAsync = true;
            DMLService.performUpdateDML(leadsToUpdateList, SCOPE);
            leadsToUpdateList.clear();
            LeadTriggerHandler.runPopulateArchivedDateAndIsArchivedCheckboxInAsync = false;
            DMLService.performInsertDML(tasksToCreateList, SCOPE);
            tasksToCreateList.clear();
            sendBulkNotifications();
            AsyncOperationUtil.dmlCachedAsyncOperations();
            insertApplicationLogs();
        }
    }

    private static void checkOpportunities(Map<String, Lead> phoneNumberToLeadMap) {
        if (!phoneNumberToLeadMap.isEmpty()) {
            for (Opportunity oppRecord : OpportunityData.getActiveOpportunitiesByPhoneNumbers(phoneNumberToLeadMap.keySet())) {
                if (unProcessedPhoneSet.contains(oppRecord.Formatted_Phone__c)){  
                    unProcessedPhoneSet.remove(oppRecord.Formatted_Phone__c);
                    Lead leadRecord = phoneNumberToLeadMap.get(oppRecord.Formatted_Phone__c);
                    Lead leadToUpdate = new Lead();
                    leadToUpdate.Id = leadRecord.Id;
                    leadToUpdate.Status = LEAD_STATUS_ARCHIVE;
                    leadToUpdate.Sub_Disposition__c = LEAD_STATUS_SUB_DISPO_ACTIVE_OPP_EXISTS;
                    leadsToUpdateList.add(leadToUpdate);
                    Task task1 = SystemActivityService.createSystemActivity(SCOPE, TASK_DESC_ACTIVE_OPP, leadRecord.Id, TaskUtil.TASK_STATUS_COMPLETED);
                    Task task2 = SystemActivityService.createSystemActivity(SCOPE, TASK_DESC_ACTIVE_OPP_OWNER, oppRecord.Id, TaskUtil.TASK_STATUS_COMPLETED);
                    Task task3 = SystemActivityService.createSystemActivityWithTaskType(SCOPE, TASK_DESC_CALL_TO_CLIENT, oppRecord.Id, TaskUtil.TASK_STATUS_PENDING, TaskUtil.TASK_TYPE_CALL);
                    tasksToCreateList.add(task1);
                    tasksToCreateList.add(task2);
                    tasksToCreateList.add(task3);
                //  createRedTrackEventAsyncOperations(leadRecord, oppRecord);
                    
                    collectNotificationData(oppRecord, leadRecord);
                                    
                    if (oppRecord.Lead_Source_Category__c != 'Web') {
                        Opportunity oppToUpdate = new Opportunity();
                        oppToUpdate.Id = oppRecord.Id;
                        oppToUpdate.LeadSource = leadRecord.LeadSource;
                        oppToUpdate.Ad_Click_Id__c = leadRecord.Ad_Click_Id__c;
                        oppToUpdateList.add(oppToUpdate);
                    } else if ( (oppRecord.Re_shuffle_Opportunity__c == true || oppRecord.Opportunity_Reshuffled_DateTime__c != null
                                 || oppRecord.Opportunity_Reinstated_DateTime__c != null || oppRecord.Opportunity_Reactivated_DateTime__c != Null )
                               && String.isBlank(oppRecord.Ad_Click_Id__c) ){
                        Opportunity oppToUpdate = new Opportunity();
                        oppToUpdate.Id = oppRecord.Id;   
                        oppToUpdate.LeadSource = leadRecord.LeadSource;
                        oppToUpdate.Ad_Click_Id__c = leadRecord.Ad_Click_Id__c;
                        oppToUpdateList.add(oppToUpdate);
                    }  
                }
            }
        }
    }
    
    private static void checkInactiveReshuffledOpportunities(Map<String, Lead> phoneNumberToLeadMap) {
        if (!phoneNumberToLeadMap.isEmpty()) {
            for (Opportunity oppRecord :  OpportunityData.getInactiveReshuffledOpportunitiesByPhoneNumbers(phoneNumberToLeadMap.keySet())) {
                String phone = oppRecord.Formatted_Phone__c;
              //  if (unProcessedPhoneSet.contains(oppRecord.Formatted_Phone__c)){  
             //       unProcessedPhoneSet.remove(phone);
                    
                    Opportunity oppToUpdate = new Opportunity();
                    oppToUpdate.Id = oppRecord.Id;
                    oppToUpdate.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;
                    oppToUpdate.sub_disposition__c = OpportunityUtil.SUB_DISPOSITION_DUPLICATE;
                    oppToUpdateList.add(oppToUpdate);
                    
                    Task task1 = SystemActivityService.createSystemActivity(SCOPE, TASK_DESC_RESHUFFLED_OPP_ARCHIVED, oppRecord.Id, TaskUtil.TASK_STATUS_COMPLETED);
                    tasksToCreateList.add(task1);
              //  }
            }
        }
    }
    
    
     /**
     * @description: Check Duplicate Leads Exists with Same phone number
     * @param phoneNumberToLeadMap: map of phone to Lead.
     */
    private static void checkLeads(Map<String, Lead> phoneNumberToLeadMap) {
        if (!phoneNumberToLeadMap.isEmpty()) {
            for (Lead leadRecordQueried : LeadData.getLeadsByPhoneNumbers(phoneNumberToLeadMap.keySet(), inputLeadIds)) {
                if (unProcessedPhoneSet.contains(leadRecordQueried.Formated_Phone__c)) {
                    unProcessedPhoneSet.remove(leadRecordQueried.Formated_Phone__c);
                    Lead leadToUpdate = new Lead();
                    leadToUpdate.Id = leadRecordQueried.Id;
                    leadToUpdate.Status = LEAD_STATUS_ARCHIVE;
                    leadToUpdate.Sub_Disposition__c = LEAD_STATUS_SUB_DISPO_ACTIVE_LEAD_EXISTS;
                    leadsToUpdateList.add(leadToUpdate);
                    Task task1 = SystemActivityService.createSystemActivity(SCOPE, TASK_DESC_NEW_LEAD, leadRecordQueried.Id, TaskUtil.TASK_STATUS_COMPLETED);
                    tasksToCreateList.add(task1);
                }
            }
        }
    }

    private static void processNewLeads(Set<Id> leadIdsToProcess) {
        if (!leadIdsToProcess.isEmpty()) {
            for (Lead leadRecordQueried : LeadData.getLeadsByLeadIds(leadIdsToProcess)) {
                if (unProcessedPhoneSet.contains(leadRecordQueried.Formated_Phone__c)) {
                    unProcessedPhoneSet.remove(leadRecordQueried.Formated_Phone__c);
                    Task task1 = SystemActivityService.createSystemActivity(SCOPE, TASK_DESC_DEDUPE_DONE, leadRecordQueried.Id, TaskUtil.TASK_STATUS_COMPLETED);
                    tasksToCreateList.add(task1);
                } 
            }
        }
    }
    /**
     * @description: Collect notification data for bulk processing
     * @param oppRecord: Opportunity record
     * @param leadRecord: Lead record that triggered the notification
     */
    private static void collectNotificationData(Opportunity oppRecord, Lead leadRecord) {
        NotificationData notifData = new NotificationData();
        notifData.ownerId = oppRecord.OwnerId;
        notifData.ownerEmail = oppRecord.Owner.Email;
        notifData.opportunityId = oppRecord.Id;
        notifData.opportunityName = oppRecord.Name;
        notifData.opportunityOwnerFullName = oppRecord.Owner.Name;
        notifData.opportunityStageName = oppRecord.StageName;  
        notifData.leadId = leadRecord.Id;
        notifData.leadSource = leadRecord.LeadSource;
        notifData.phoneNumber = leadRecord.Formated_Phone__c;

        notificationsToSend.put(oppRecord.Id, notifData);
    }

    /**
     * @description: Send all collected notifications in bulk
     */
    private static void sendBulkNotifications() {
        if (notificationsToSend.isEmpty()) {
            return;
        }

        try {
            // Send bell notifications in bulk
            sendBulkBellNotifications();

            // Send email notifications in bulk
            sendBulkEmailNotifications();

        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, 'Error sending bulk notifications',
                'Total notifications: ' + notificationsToSend.size(),
                Null);
        } finally {
            // Clear the collection
            notificationsToSend.clear();
        }
    }

    /**
     * @description: Send bell notifications in bulk using Custom Notification
     */
      private static void sendBulkBellNotifications() {
        try {
            List<CustomNotificationType> notificationTypes = [
                SELECT Id, DeveloperName
                FROM CustomNotificationType
                WHERE DeveloperName = 'Custom_Notification'
                LIMIT 1
            ];
    
            if (notificationTypes.isEmpty()) {
                ApplicationLogger.logExceptionWithData(null, 'Custom Notification Type not found',
                    'DeveloperName: Custom_Notification', Null);
                return;
            }
    
            CustomNotificationType notificationType = notificationTypes[0];
    
            for (NotificationData notifData : notificationsToSend.values()) {
    
                String notificationBody = NOTIFICATION_BODY + ' Opportunity: ' + notifData.opportunityName;
    
                Messaging.CustomNotification notification = new Messaging.CustomNotification();
                notification.setTitle(NOTIFICATION_TITLE);
                notification.setBody(notificationBody);
                notification.setNotificationTypeId(notificationType.Id);
                notification.setTargetId(notifData.opportunityId); 
    
                Set<String> recipientIds = new Set<String>{ notifData.ownerId };
                notification.send(recipientIds);
            }
    
        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, 'Error sending bulk bell notifications',
                'Total notifications: ' + notificationsToSend.size(), Null);
        }
    }
    /**
     * @description: Send email notifications in bulk
     */
     private static void sendBulkEmailNotifications() {
        try {
            EmailTemplate et = EmailTemplateService.getEmailTemplateByName('New Duplicate Web Lead Created Alert Opportunity Owner');
            
            List<EmailTemplateService.EmailRequest> emailRequests = new List<EmailTemplateService.EmailRequest>();

            for (NotificationData notifData : notificationsToSend.values()) {
                if (String.isNotBlank(notifData.ownerEmail)) {
                    Map<String, String> mergeFields = new Map<String, String>();
                    mergeFields.put('Opportunity.Name', notifData.opportunityName);
                    mergeFields.put('Opportunity.Id', notifData.opportunityId);
                    mergeFields.put('Opportunity.OwnerFullName', notifData.opportunityOwnerFullName); 
                    mergeFields.put('Opportunity.StageName', notifData.opportunityStageName);         
                    mergeFields.put('Organization.BaseUrl', URL.getOrgDomainUrl().toExternalForm());  
                    mergeFields.put('Lead.LeadSource', notifData.leadSource != null ? notifData.leadSource : '');
                    mergeFields.put('Lead.Phone', notifData.phoneNumber != null ? notifData.phoneNumber : '');

                    emailRequests.add(new EmailTemplateService.EmailRequest(
                        new List<String>{notifData.ownerEmail},
                        et.Subject,
                        et.HtmlValue,
                        true,
                        mergeFields
                    ));
                }
            }

            if (!emailRequests.isEmpty()) {
                EmailTemplateService.sendBulkEmails(emailRequests);
            }

        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, 'Error sending bulk email notifications',
                'Total emails: ' + notificationsToSend.size(), Null);
        }
    }

    private static void insertApplicationLogs() {
        try {
            ApplicationLogger.insertStoredLogs();
        } catch(Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
    }
    
    private static Boolean isDeduplicationDisabled() {
        Boolean isDisabled = false;
        try {
            System_Control_Settings__mdt setting = [
                SELECT Disable_Web_lead_Deduplication__c 
                FROM System_Control_Settings__mdt
                LIMIT 1
            ];
            if (!Test.isRunningTest()) {
                isDisabled = setting != null ? setting.Disable_Web_lead_Deduplication__c : false;
            }
        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
        return isDisabled;
   }
    
     /**
    * @description: Inner class to hold notification data
    */
   private class NotificationData {
       public Id ownerId;
       public Id opportunityId;
       public String opportunityName;
       public Id leadId;
       public String leadSource;
       public String phoneNumber;
       public String ownerEmail;
       public String opportunityStageName;
       public String opportunityOwnerFullName;
   }

  /* private static void createRedTrackEventAsyncOperations(Lead leadRecord, Opportunity oppRecord) {
        if (String.isNotBlank(leadRecord.Ad_Click_Id__c)) {
            if (String.isNotBlank(leadRecord.LeadSource) && leadRecord.LeadSource.startsWith('IB')) {
                AsyncOperationUtil.createAsyncOperationRecord(leadRecord.Id, AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION);
                AsyncOperationUtil.createAsyncOperationRecord(leadRecord.Id, AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION);
            } else {
                AsyncOperationUtil.createAsyncOperationRecord(leadRecord.Id, AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION);
                AsyncOperationUtil.createAsyncOperationRecord(leadRecord.Id, AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION);
            }
            AsyncOperationUtil.createAsyncOperationRecord(oppRecord.Id, AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION);
        }
    } */
}