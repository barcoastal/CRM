public inherited sharing class LeadLifeCycleHandler {

    private static final String SUB_DISPO_ACTIVE_OPP_EXISTS = 'Active Opportunity Exists';
    private static final String SUB_DISPO_ACTIVE_WEB_LEAD_EXISTS = 'Active Web Lead Exists'; 
    private static final String SUB_DISPO_NEW_WEB_LEAD = 'New Web Lead Created';
    private static final String SUB_DISPO_NEW_NON_WEB_LEAD = 'New Non-Web Lead Created';

    private static final String TASK_SUB_ACTIVE_OPP_EXISTS = 'New Lead was created and archived as the Active Opportunity exists for that client';
    private static final String TASK_SUB_ACTIVE_WEB_LEAD_EXISTS = 'New Lead was created and archived as the Active Web Lead exists for that client';
    private static final String TASK_SUB_NEW_WEB_LEAD_CREATED_EXISTING_NON_WEB_LEAD_ARCHIVED = 'The Non Web Lead owned by you is archived as the new Web Lead is created for the same client';
    private static final String TASK_SUB_NEW_NON_WEB_LEAD_CREATED_EXISTING_NON_WEB_LEAD_ARCHIVED = 'The Non Web Lead owned by you is archived as the new Non Web Lead is created for the same client';
    
    public static void handleLeadLifeCycle(Map<Id, Lead> newLeadIdLeadMap, Map<Id, Individual> leadIdIndividualMap, Map<Id, Lead> activeLeadIdLeadMap) {
        List<Lead> leadsToUpdateList = new List<Lead>();
        List<Task> tasksToCreateList = new List<Task>();
        List<Individual> individualsToUpdateList = new List<Individual>();
        for (Id leadId : leadIdIndividualMap.keySet()) {
            Individual individualRecord = leadIdIndividualMap.get(leadId);
            if (individualRecord.Active_Opportunity__c != null) {
                Lead leadToUpdate = constructLeadInstance(leadId);
                archiveLead(leadToUpdate, SUB_DISPO_ACTIVE_OPP_EXISTS);
                leadsToUpdateList.add(leadToUpdate);
                Task taskToCreate = createTaskInstance(TASK_SUB_ACTIVE_OPP_EXISTS, individualRecord.Active_Opportunity__r.OwnerId, individualRecord.Active_Opportunity__c);
                tasksToCreateList.add(taskToCreate);
            } else if (individualRecord.Active_Lead__c != null) {
                Lead newLead = newLeadIdLeadMap.get(leadId);
                //If the activeLeadIdLeadMap does not contain the Lead Id, throw exception for this record.
                Lead existingLead = activeLeadIdLeadMap.get(leadId);
                HandleExistingLeadResponse response = handleExistingLead(newLead, existingLead);
                if (response != null) {
                    if (response.leadsList != null) {
                        for(Lead lead : response.leadsList){
                            if(lead.Status != LeadUtil.LEAD_ARCHIVED_STATUS && lead.Id != individualRecord.Active_Lead__c){
                                Individual individualToUpdate = populateActiveLeadForIndividual(individualRecord,lead.Id);
                                individualsToUpdateList.add(individualToUpdate);
                            }
                        }
                        leadsToUpdateList.addAll(response.leadsList);
                    }
                    if (response.tasksList != null) {
                        tasksToCreateList.addAll(response.tasksList);
                    }
                }   
            } else {
                Lead leadToUpdate = constructLeadInstance(leadId);
                newLead(leadToUpdate);
                leadsToUpdateList.add(leadToUpdate);
                //Create Update Individual Instances to populate the current lead as a Active Lead in Individual.
                Individual individualToUpdate = populateActiveLeadForIndividual(individualRecord,leadId);
                individualsToUpdateList.add(individualToUpdate);
            }
        }
        update leadsToUpdateList;
        insert tasksToCreateList;
        update individualsToUpdateList;
    }

    private static Individual populateActiveLeadForIndividual(Individual individualRecord,Id leadId){
        individualRecord.Active_Lead__c = leadId;
        individualRecord.Active_Entities_Assignment_Status__c = IndividualUtil.ACTIVE_ENTITY_ASSIGNED;
        return individualRecord;
    }

    private static HandleExistingLeadResponse handleExistingLead(Lead newLead, Lead existingLead) {
        HandleExistingLeadResponse response = new HandleExistingLeadResponse();
        List<Lead> leadsToUpdate = new List<Lead>();
        List<Task> tasksToCreate = new List<Task>();
        if (existingLead.Lead_Source_Category__c == LeadUtil.LEAD_SOURCE_WEB) {
            if (newLead.Lead_Source_Category__c == LeadUtil.LEAD_SOURCE_WEB) {
                Boolean leadAppended = LeadUtil.appendLead(
                existingLead, //source lead
                newLead//target lead
                );
                if (leadAppended) {
                  leadsToUpdate.add(newLead);
                }
                archiveLead(existingLead, SUB_DISPO_NEW_WEB_LEAD);
                leadsToUpdate.add(existingLead);
                Task taskToCreate = createTaskInstance(TASK_SUB_ACTIVE_WEB_LEAD_EXISTS, existingLead.OwnerId, existingLead.Id);
                tasksToCreate.add(taskToCreate);
            } else if (newLead.Lead_Source_Category__c != LeadUtil.LEAD_SOURCE_WEB) {
                Boolean leadAppended = LeadUtil.appendLead(
                newLead,//source lead
                existingLead//target lead
                );
                if (leadAppended) {
                  leadsToUpdate.add(existingLead);
                }
                archiveLead(newLead, SUB_DISPO_ACTIVE_WEB_LEAD_EXISTS);
                leadsToUpdate.add(newLead);
                Task taskToCreate = createTaskInstance(TASK_SUB_ACTIVE_WEB_LEAD_EXISTS, existingLead.OwnerId, existingLead.Id);
                tasksToCreate.add(taskToCreate);
            }
       /*     archiveLead(existingLead, SUB_DISPO_NEW_WEB_LEAD);
            leadsToUpdate.add(existingLead);
            Task taskToCreate = createTaskInstance(SUB_DISPO_NEW_WEB_LEAD, existingLead.OwnerId, existingLead.Id);
            tasksToCreate.add(taskToCreate);*/
        } else if (existingLead.Lead_Source_Category__c != LeadUtil.LEAD_SOURCE_WEB) {
            Boolean leadAppended = LeadUtil.appendLead(
                existingLead, //source lead
                newLead //target lead
            );
            if (leadAppended) {
                leadsToUpdate.add(newLead);
            }
            if (newLead.Lead_Source_Category__c == LeadUtil.LEAD_SOURCE_WEB) {
                archiveLead(existingLead, SUB_DISPO_NEW_WEB_LEAD);
                Task taskToCreate = createTaskInstance(TASK_SUB_NEW_WEB_LEAD_CREATED_EXISTING_NON_WEB_LEAD_ARCHIVED, existingLead.OwnerId, existingLead.Id);
                tasksToCreate.add(taskToCreate);
            } else if (newLead.Lead_Source_Category__c != LeadUtil.LEAD_SOURCE_WEB) {
                archiveLead(existingLead, SUB_DISPO_NEW_NON_WEB_LEAD);
                Task taskToCreate = createTaskInstance(TASK_SUB_NEW_NON_WEB_LEAD_CREATED_EXISTING_NON_WEB_LEAD_ARCHIVED, existingLead.OwnerId, existingLead.Id);
                tasksToCreate.add(taskToCreate);
            }
            leadsToUpdate.add(existingLead);
        } 
        response.leadsList = leadsToUpdate;
        response.tasksList = tasksToCreate;
        return response;
    }

    public class HandleExistingLeadResponse {
        public List<Lead> leadsList;
        public List<Task> tasksList;
    }

    private static Lead constructLeadInstance(Id leadId) {
        Lead leadInstance = new Lead();
        leadInstance.Id = leadId;
        return leadInstance;
    }

    private static void archiveLead(Lead leadInstance, String subDisposition) {
        leadInstance.Status = LeadUtil.LEAD_ARCHIVED_STATUS;
        leadInstance.Sub_Disposition__c = subDisposition;
    }

    private static Lead newLead(Lead leadInstance) {
        leadInstance.Status = LeadUtil.LEAD_NEW_STATUS;
        return leadInstance;
    }

    private static Task createTaskInstance(String subject, Id ownerId, Id relatedRecordId) {
        Task taskRec = new Task();
        taskRec.Subject = subject;
        taskRec.OwnerId = ownerId;
        if (ApexUtil.isWhoId(relatedRecordId)) {
            taskRec.WhoId = relatedRecordId;
        } else {
            taskRec.whatId = relatedRecordId;
        }
        taskRec.IsReminderSet = True;
        taskRec.ReminderDateTime = System.now();
        return taskRec;
    }
}