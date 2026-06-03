public class Five9ListSyncHandler {
   
    public static void createDeleteFromFive9AsyncReocrds(set<Id> leadIds,String five9ListName){
      try{
          list<Async_Operation__c> asyncOperationToInsert = New list<Async_Operation__c>();
          Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,'Lead');
            for(Id leadId : leadIds){
                    Async_Operation__c asyncOperation = new Async_Operation__c();
                    asyncOperation.Lead__c = leadId;
                    asyncOperation.Status__c = 'Pending';
                    asyncOperation.Operation__c = 'Remove Lead From Five9 - API';
                    asyncOperation.Async_Type__c = 'Batch';
                    asyncOperation.Record_Id__c = leadId;
                    asyncOperationToInsert.add(asyncOperation);
            }
            insert asyncOperationToInsert;
        }catch(Exception ex){
           ApplicationLogger.logDMLException('createDeleteFromFive9AsyncReocrds', '', ex.getmessage());
        }
    }
}