public class Five9RemoveNumbersFromDNC {
    @InvocableMethod(label = 'Remove Numbers From DNC')
    public static List<FlowOutputVariable> removeNumbersFromDNCBasedOnRecordId(List<Id> recordId){
        Boolean CalloutSuccess;
        List<FlowOutputVariable> outputVarList = new List<FlowOutputVariable>();
        FlowOutputVariable var = New FlowOutputVariable();
        String five9ListName = System.Label.Five9_List_Name;
        String objectName = ApexUtil.getSObjectName(recordId[0]);
        //Get the parent five9 list data which contains the five9 list configurations
       // Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,objectName);
         Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();
        List<String> numberList = Five9AddNumbersToDnc.phoneNumberListForDNC(recordId,false,false,objectName);
        if(numberList.size()>0){
            //Construct the body document for addToFive9List callout with nested xml nodes having five9 config and sf data
            DOM.Document document = new DOM.Document();
            document = Five9ListService.removeNumbersFromDnc(numberList);
            CalloutSuccess = Five9ListService.calloutToFive9(document, five9ApiSettings,'removeNumbersFromDncResponse');
            if(CalloutSuccess == true){
                List<String> updateRecords = Five9AddNumbersToDnc.phoneNumberListForDNC(recordId,false,true,objectName);
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
    
}