/*----------------------------------------------------------------
    Author: Vignesh P
    Description: A Handler class to perform after trigger actions of the Lead object
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Aug-05-2024     Vignesh                  Initial Development       
    July-14-2025    Vignesh                  Removed the individual methods for different async operations instead of having generic method         
--------------------------------------------------------------------*/
public inherited sharing class LeadAfterTriggerHelper {

    public static final Set<String> SUB_DISPO_REMOVE_FROM_FIVE9 = new Set<String> {'Not Enough Debt', 'Wrong Number', 'DNC (Do not call)', 'Fake Lead'};
    public static final Set<String> SUB_DISPO_ADD_TO_DNC = new Set<String>{'DNC (Do not call)'};
    public static final String REMOVE_LEAD_FIVE9_FINAL_DISPOSITION = 'Remove Lead From Five9 - Lead Final Disposition';

    /**
     * Author: Vignesh P
     * Description: To remove the lead and its duplicate leads from Five9 list. This method will support only for after update.
    */
    public static void removeLeadsFromFive9() {
        if (Trigger.isAfter && Trigger.isUpdate) {
            Set<Id> leadIds = new Set<Id>();
            Map<String, String> phoneNumbersOperationTypeMap = new Map<String, String>();
            for (Lead leadRecord : (List<Lead>)Trigger.new) {
                Lead oldLeadRecord = (Lead)Trigger.oldMap.get(leadRecord.Id);
                if (String.isNotBlank(leadRecord.Phone) && leadRecord.Sub_Disposition__c != oldLeadRecord.Sub_Disposition__c 
                    && SUB_DISPO_REMOVE_FROM_FIVE9.contains(leadRecord.Sub_Disposition__c)
                ) {
                    leadIds.add(leadRecord.Id);
                    phoneNumbersOperationTypeMap.put(leadRecord.Phone, REMOVE_LEAD_FIVE9_FINAL_DISPOSITION);
                }
            }
            if (!phoneNumbersOperationTypeMap.isEmpty()) {
                RemoveFromFive9Async.removeLeadsFromFive9(phoneNumbersOperationTypeMap, leadIds);
            }
        }
    }
/**
     * Author: Vignesh P
     * Description: DeduplicateLead and Remove the web leads from five9 DNC
    */
    public static void deduplicateWebLeadsAndUpdateFive9DNC() {
        if (Trigger.isAfter && Trigger.isInsert) {
            Set<Id> webLeadIds = new Set<Id>();
            map<String,lead> leadMap = new map<String,lead>();
            List<String> numbersToRemoveFromDNC = new List<String>();
            for (Lead leadRecord : (List<Lead>)Trigger.new) {
                if (leadRecord.Lead_Source_Category__c == 'Web') {
                    webLeadIds.add(leadRecord.Id);
                    if(String.isNotBlank(leadRecord.Phone)){
                        numbersToRemoveFromDNC.add(leadRecord.formated_Phone__c);
                        leadMap.put(leadRecord.formated_Phone__c,leadRecord);
                    }
                }
            }
            if (!webLeadIds.isEmpty()) {
                //Commented out the Deduplicate Lead functionality for Web leads as requested on Nov-13-2024 [CRM-574]
                //FutureHandler.deduplicateLeads(webLeadIds);
                FutureHandler.webLeadDeDuplication(webLeadIds);
            }
            if(!numbersToRemoveFromDNC.isEmpty()){
                removeLeadsFromFive9DNC(numbersToRemoveFromDNC,JSON.serialize(leadMap));
            }
        }
    }
     /**
     * Author: Yamini B
     * Description: prepare list of numbers to Add to five9 DNC
    */
    public static void addNumbersToFive9DNC(){
        if (Trigger.isAfter && Trigger.isUpdate){
            map<String,lead> leadMap = new map<String,lead>();
            List<String> dncNumberList = new List<String>();
            for (Lead leadRecord : (List<Lead>)Trigger.new){
                Lead oldLeadRecord = (Lead)Trigger.oldMap.get(leadRecord.Id);
                if (String.isNotBlank(leadRecord.Phone) && (leadRecord.Sub_Disposition__c != oldLeadRecord.Sub_Disposition__c 
                                                            && SUB_DISPO_ADD_TO_DNC.contains(leadRecord.Sub_Disposition__c)) ||
                    (leadRecord.five9_Disposition__c == 'DO NOT CALL - DNC' && leadRecord.five9_Disposition__c!=oldLeadRecord.five9_Disposition__c)){
                        dncNumberList.add(leadRecord.formated_Phone__c); 
                        leadMap.put(leadRecord.formated_Phone__c,leadRecord);
                    }
            }
            if(!dncNumberList.isEmpty()){
                addLeadsToFive9DNC(dncNumberList,JSON.serialize(leadMap));
        }
    }
 }    
     /**
     * Author: Yamini B
     * Description: To remove the lead from Five9 DNC
    */
    @future(callout=true)
    public static void removeLeadsFromFive9DNC(List<String> numberList,String leadMapJson){
        // List<String> numberList = New List<String>();
        String five9ListName = System.Label.Five9_List_Name;
       // Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,'Lead');
       Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();
        Boolean isSuccess = false;
        Map<String, Lead> leadMap = (Map<String, Lead>) JSON.deserialize(leadMapJson, Map<String, Lead>.class);
        List<String> numbersToRemoveFromDNC = new List<String>();
        set<Id> leadIdSet = new set<Id>();
        if(numberList.size()>0){
            List<String> existingDncNumbers = checkDncForNumbers(numberList);
            for (String num : numberList) {
                if (existingDncNumbers.contains(num)) { // if numbers exist in DNC then remove them from DNC
                    numbersToRemoveFromDNC.add(num);
                    leadIdSet.add(leadMap.get(num).id);
                }
            }
            if(!numbersToRemoveFromDNC.isEmpty()){
                //Construct the body document for addToFive9List callout with nested xml nodes having five9 config and sf data
                DOM.Document document = new DOM.Document();
                document = Five9ListService.removeNumbersFromDnc(numbersToRemoveFromDNC);
                isSuccess = Five9ListService.calloutToFive9(document, five9ApiSettings,'removeNumbersFromDncResponse');
            }
            if (isSuccess) {
               updateLeadDncFlag(leadIdSet, false);
            }
        }
    }
    
     /**
     * Author: Yamini B
     * Description: To Add the lead to Five9 DNC
    */
    @future(callout=true)
    public static void addLeadsToFive9DNC(List<String> numberList, String leadMapJson){
        String five9ListName = System.Label.Five9_List_Name;
       // Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,'Lead');
        Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();
        Boolean isSuccess;
        Map<String, Lead> leadMap = (Map<String, Lead>) JSON.deserialize(leadMapJson, Map<String, Lead>.class);
        set<Id> leadIdSet = new set<Id>();
        List<String> numbersToAddToDnc = new List<String>();
        if(numberList.size()>0){
            List<String> existingDncNumbers = checkDncForNumbers(numberList);
            for (String num : numberList) {
                if (!existingDncNumbers.contains(num)) { // if numbers do not exist then add them to DNC
                    numbersToAddToDnc.add(num);
                    leadIdSet.add(leadMap.get(num).id);
                }
            }
            if(!numbersToAddToDnc.isEmpty()){
                //Construct the body document for addToFive9List callout with nested xml nodes having five9 config and sf data
                DOM.Document document = new DOM.Document();
                document = Five9ListService.addNumbersToDnc(numbersToAddToDnc);
                isSuccess = Five9ListService.calloutToFive9(document, five9ApiSettings,'addNumbersToDncResponse');
            }
            if (isSuccess) {
               updateLeadDncFlag(leadIdSet, true);
            }
        } 
    }
    
    /**
     * Author: Yamini B
     * Description: To check if numbers exist in DNC
    */  
    public static List<String> checkDncForNumbers(List<String> numberList){
        String five9ListName = System.Label.Five9_List_Name;
       // Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,'Lead');
          Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();
        List<String> returnedList = new List<String>();
        if(numberList.size()>0){
            //Construct the body document for addToFive9List callout with nested xml nodes having five9 config and sf data
            DOM.Document document = new DOM.Document();
            document = Five9ListService.checkDncForNumbers(numberList);
            returnedList = Five9ListService.calloutToFive9ForDNCNumbers(document, five9ApiSettings,'checkDncForNumbersResponse');
        } 
        return  returnedList;  
    }
    
    public static void updateLeadDncFlag(set<Id> leadIdSet, Boolean dncFlag) {
      
        List<Lead> leadsToUpdate = new List<Lead>();
         List<Lead> leadRecords = LeadData.queryLeadRecords(leadIdSet);
         for (Lead lead : leadRecords) {
             if(lead.DNC__c!=dncFlag){
                 lead.DNC__c = dncFlag;
                 leadsToUpdate.add(lead);
             }
         }
      
        if (!leadsToUpdate.isEmpty()) {
            update leadsToUpdate;
        }
    }
    
     public static void shareLeadToMCA() {
        
        List<String> MCA_LENDER_SUB_DISPOSITION = System.Label.MCA_Lender_SubDispositions.split(',');
        List<String> MCA_LENDER_FIVE9_DISPOSITION = System.Label.MCA_Lender_Five9Disposition.split(',');
        List<Id> leadIds = new List<Id>();
        for (Lead leadRecord : (List<Lead>)Trigger.new){
            Lead oldLeadRecord = (Lead)Trigger.oldMap.get(leadRecord.Id);
            if((leadRecord.Sub_Disposition__c != oldLeadRecord.Sub_Disposition__c && MCA_LENDER_SUB_DISPOSITION.contains(leadRecord.Sub_Disposition__c))                    
                || (leadRecord.five9_Disposition__c != oldLeadRecord.five9_Disposition__c && MCA_LENDER_FIVE9_DISPOSITION.contains(leadRecord.five9_Disposition__c))
                || (leadRecord.Lead_Source_Category__c != oldLeadRecord.Lead_Source_Category__c && leadRecord.Lead_Source_Category__c != 'Web')){ 
                
                //makeMCACallout(leadRecord.Id);  
                leadIds.add(leadRecord.Id);
                
            }
        }
       
        
        if(!leadIds.isEmpty()){
            Id JobId = System.enqueueJob(new MCALenderAPICallout(leadIds));
        }
    }
    
    /**This future method called from another future so we moved to queueable method.
    @future(Callout=true)
    private static void makeMCACallout(Id leadId) {
        MCALenderAPICallout.makeMCALenderCallout(leadId);
    }*/
    
    public static Map<Lead,Individual> createIndividualRecords() {
        Set<String> phoneNumbersSet = new Set<String>();
        Map<Lead,Individual> leadsToUpdateWithIndividual = new Map<Lead,Individual>();
        try {
            List<Lead> leadsToProcessList = new List<Lead>();
            if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate)) {
                for (Lead leadInst : (List<Lead>) Trigger.new) {
                    if (leadInst.Formated_Phone__c != null && ApexUtil.isValidPhoneNumber(leadInst.Formated_Phone__c)) {
                        if (Trigger.isInsert || Trigger.isUpdate && leadInst.Phone != ((Lead)Trigger.oldMap.get(leadInst.Id)).Phone) {
                            phoneNumbersSet.add(leadInst.Formated_Phone__c);
                            leadsToProcessList.add(leadInst);
                        }
                    }
                } 
                if (!phoneNumbersSet.isEmpty()) {
                    leadsToUpdateWithIndividual = IndividualHandler.constructLeadsWithIndividual(phoneNumbersSet, leadsToProcessList);
    }
    
                if (leadsToUpdateWithIndividual != null && !leadsToUpdateWithIndividual.isEmpty()) {
                    LeadTriggerHandler.byPassLeadTrigger = true;
                    List<lead> leadsToUpdate = new List<Lead>(leadsToUpdateWithIndividual.keySet());
                    update leadsToUpdate;
                    LeadTriggerHandler.byPassLeadTrigger = false;
                }
            }
        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
       }
        return leadsToUpdateWithIndividual;
     }    
    
    public static void removeActiveLeadFormIndividual() {
        try{
            List<Individual> individualsToUpdate = New List<Individual>();
            Set<Id> leadsArchived = New Set<Id>();
            if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate )) {  
                for(Lead leadInst : (List<Lead>) Trigger.new){
                  if (Trigger.isInsert || Trigger.isUpdate && leadInst.status != ((Lead)Trigger.oldMap.get(leadInst.Id)).status) {
                    if(leadInst.status == leadUtil.LEAD_ARCHIVED_STATUS){
                        if(leadInst.IndividualId != Null ){
                                leadsArchived.add(leadInst.Id);
                        } 
                    }
                  }
                }
            }
            List<Individual> individualsList = IndividualData.queryIndividaulsByActiveLead(leadsArchived);
            for(Individual ind: individualsList){
                if(ind.Active_Lead__r.Status == leadUtil.LEAD_ARCHIVED_STATUS){
                  ind.Active_Lead__c = Null;
                  ind.Active_Entities_Assignment_Status__c = IndividualUtil.NO_ACTIVE_ENTITIES;
                  individualsToUpdate.add(ind);
                }
            }
            update individualsToUpdate;
        }catch(Exception ex){
          ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
    } 
     
    public static void archiveLeadsBasedOnDisposition(List<Lead> newLeads, Map<Id, Lead> oldMap) {
        for (Lead newLead : newLeads) {
            Lead oldLead = oldMap.get(newLead.Id);
            if (newLead.five9_Disposition__c != oldLead.five9_Disposition__c) {
                if (newLead.five9_Disposition__c == leadUtil.FAKE_DISPOSITION 
                    	|| newLead.five9_Disposition__c == leadUtil.LEAD_DIDNOT_REGISTER_DISPOSITION) {
                    newLead.Status = leadUtil.LEAD_ARCHIVED_STATUS;
                    newLead.Is_Archived__c = true;
                    newLead.Sub_Disposition__c = leadUtil.LEAD_FAKE_DISPOSITION;
                }
            }
        }
    }

    public static void createAsyncRecordsForArchivedLeads(){
        Set<Id> leadIds = new Set<Id>();
        if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate )) {  
           for(Lead leadInstance : (List<Lead>) trigger.new){
               if(Trigger.isInsert || Trigger.isUpdate && ((Lead) Trigger.oldMap.get(leadInstance.Id)).status != leadInstance.status){
                   if(leadInstance.status == leadUtil.LEAD_ARCHIVED_STATUS){
                       leadIds.add(leadInstance.Id);
                   }
               }
           }
        }
        if(!leadIds.isEmpty()){
           String five9ListName = System.Label.Five9_List_Name;
           Five9ListSyncHandler.createDeleteFromFive9AsyncReocrds(leadIds,five9ListName);
        }
    }
    
     public static void populateArchivedDateAndIsArchivedCheckbox(){
        List<Lead> leadsToUpdate = New List<lead>();
          if (Trigger.isBefore && (Trigger.isInsert || Trigger.isUpdate )) {  
                for(Lead leadInst : (List<Lead>) Trigger.new){
                  if (Trigger.isInsert || Trigger.isUpdate && leadInst.status != ((Lead)Trigger.oldMap.get(leadInst.Id)).status) {
                        if(leadInst.status == leadUtil.LEAD_ARCHIVED_STATUS){
                            LeadInst.Is_Archived__c = true;
                            LeadInst.Archived_Date__c = date.today();
                            LeadInst.Delete_from_f9list_id__c = LeadInst.Five9_List_Id__c;
                            leadInst.Five9_List_Id__c = '';
                        }
                  }
                }
          }
    }
    
    public static void subDispoRequiredForArchivedLeads(){
       try{
           if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate )) {  
               for(Lead leadInstance : (List<Lead>) trigger.new){
                   if(Trigger.isInsert || Trigger.isUpdate && ((Lead) Trigger.oldMap.get(leadInstance.Id)).status != leadInstance.status){
                       if(leadInstance.status == leadUtil.LEAD_ARCHIVED_STATUS && leadInstance.Sub_Disposition__c == Null){
                           Throw New leadCustomException('Sub Disposition is Required When lead is Archived',leadInstance.Id);
                       }
                   }
               }
            }
        }catch(leadCustomException ex){
             ApplicationLogger.logExceptionWithData(ex, ex.recordId, null, ApplicationLogger.SEVERITY_HIGH);
        }
    }
    
    public static void populateFronterDetailsInOpp(){
        try{
           Map<Id, Lead> leadOldMap = (Map<Id, Lead>) Trigger.oldMap;
           Map<Id, Lead> oppIdToLeadMap = new Map<Id, Lead>();
           Set<String> leadIds = New Set<String>();
           if (Trigger.isAfter && Trigger.isUpdate ) {  
               for(Lead leadInstance : (List<Lead>) trigger.new){
                   if(leadInstance.IsConverted && leadInstance.ConvertedOpportunityId != Null && ((leadOldMap.get(leadInstance.Id)).FronterLookup__c != leadInstance.FronterLookup__c 
                                              || (leadOldMap.get(leadInstance.Id)).Call_Transferred_By_Lookup__c != leadInstance.Call_Transferred_By_Lookup__c
                                              || (leadOldMap.get(leadInstance.Id)).Call_Tranferred_DateTime__c != leadInstance.Call_Tranferred_DateTime__c
                                               )){
                    oppIdToLeadMap.put(leadInstance.ConvertedOpportunityId, leadInstance);
                   }
               }
               
               if(!oppIdToLeadMap.isEmpty()) {
                 syncOpportunities(oppIdToLeadMap);
               }
            }
        }catch(Exception ex){
             ApplicationLogger.logExceptionWithData(ex,Null, 'populateFronterDetailsInOpp On Lead Trigger Failed ', ApplicationLogger.SEVERITY_HIGH);
        }
    }
    
    private static void syncOpportunities(Map<Id, Lead> oppIdToLeadMap) {
        List<Opportunity> oppsToUpdate = new List<Opportunity>();

        List<Opportunity> relatedOpps = OpportunityData.queryOpportunities(oppIdToLeadMap.keySet());
        for (Opportunity opp : relatedOpps) {
            Lead sourceLead = oppIdToLeadMap.get(opp.Id);

            opp.FronterLookup__c = sourceLead.FronterLookup__c;
            opp.Call_Transferred_By_Lookup__c = sourceLead.Call_Transferred_By_Lookup__c;
            opp.Call_Tranferred_DateTime__c = sourceLead.Call_Tranferred_DateTime__c;
            
            oppsToUpdate.add(opp);
        }

        if (!oppsToUpdate.isEmpty()) {
            OpportunityTriggerHandler.byPassOpportunityTrigger = true;
            update oppsToUpdate;
            OpportunityTriggerHandler.byPassOpportunityTrigger = false;
        }
    }
    
    public class leadCustomException extends Exception {
        public String recordId { get; set; }
    
        public leadCustomException(String message, String recordId) {
            this.setMessage(message); 
            this.recordId = recordId;
        }
    }
 }