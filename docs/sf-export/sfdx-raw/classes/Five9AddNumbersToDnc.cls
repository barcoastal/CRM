public class Five9AddNumbersToDnc {
    @InvocableMethod(label = 'Add Numbers To DNC')
    public static List<FlowOutputVariable> addNumbersToDNCBasedOnRecordId(List<Id> recordId){
        Boolean CalloutSuccess;
        List<FlowOutputVariable> outputVarList = new List<FlowOutputVariable>();
        FlowOutputVariable var = New FlowOutputVariable();
        String five9ListName = System.Label.Five9_List_Name;
        String objectName = ApexUtil.getSObjectName(recordId[0]);
        //Get the parent five9 list data which contains the five9 list configurations
      //  Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,objectName);
        Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();
        List<String> numberList = phoneNumberListForDNC(recordId,false,false,objectName);
        if(numberList.size()>0){
            //Construct the body document for addToFive9List callout with nested xml nodes having five9 config and sf data
            DOM.Document document = new DOM.Document();
            document = Five9ListService.addNumbersToDnc(numberList);
            CalloutSuccess = Five9ListService.calloutToFive9(document, five9ApiSettings,'addNumbersToDncResponse');
            if(CalloutSuccess == true){
                List<String> updateRecords = phoneNumberListForDNC(recordId,true,false,objectName);
                var.isSuccess = true;
                outputVarList.add(var);
            }
            else{
                var.isSuccess = false;
                outputVarList.add(var);
            }
        }
        return outputVarList;
    }
    
    public class FlowOutputVariable{
        @InvocableVariable
        public Boolean isSuccess;
        
    }
    
    //method to add/remove numbers from DNC List
    public static List<String> phoneNumberListForDNC(List<Id> recordId,Boolean addToDNCList, Boolean removeFromDNCList,String objectName){
        List<String> numberList = new List<String>();
        Map<String, SObject> recordsToUpdate = new Map<String, SObject>(); // Map to store records for update
        List<Lead> leadList = New List<Lead>();
        List<Opportunity> oppList = New List<Opportunity>();
        List<Contact> conList = New List<Contact>();
        if(objectName == 'Lead'){
            leadList = LeadData.queryLeadsPhoneNumbers(recordId[0]);
            if(leadList.size()>0){
                if(leadList[0].Phone!=null){
                    numberList.add(leadList[0].Phone);
                }
                if(leadList[0].MobilePhone!=null){
                    numberList.add(leadList[0].MobilePhone);
                }
                if(leadList[0].Work_Phone__c!=null){
                    numberList.add(leadList[0].Work_Phone__c);
                }
            }
            if(addToDNCList == true){
                leadList[0].DNC__c = true;
                recordsToUpdate.put( leadList[0].Id,  leadList[0]);
            }
            if(removeFromDNCList == true){
                leadList[0].DNC__c = false;
                recordsToUpdate.put( leadList[0].Id,  leadList[0]);
            }
        }
        else if(objectName == 'Opportunity'){
            oppList = OpportunityData.queryOpportunity(recordId[0]);
            if(oppList.size()>0){
                if(oppList[0].Phone__c!=null){
                    numberList.add(oppList[0].Phone__c);
                } 
            }
            if(addToDNCList == true){
                oppList[0].DNC__c = true;
                recordsToUpdate.put(oppList[0].Id, oppList[0]);
            }
            if(removeFromDNCList == true){
                oppList[0].DNC__c = false;
                recordsToUpdate.put(oppList[0].Id, oppList[0]);
            }
        }
        // Update records
        if (!recordsToUpdate.isEmpty()) {
            update recordsToUpdate.values();
        }
        return numberList;
    } 
}