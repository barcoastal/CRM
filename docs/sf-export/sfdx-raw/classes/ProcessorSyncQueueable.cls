public  inherited sharing class ProcessorSyncQueueable implements Queueable, Database.AllowsCallouts {
    
    public Id accountId;
    
    public ProcessorSyncQueueable(Id accId) {
        this.accountId = accId;
    }
    
    public void execute(QueueableContext context) {
         try{
             ProcessorCreateAPI procInstance = new ProcessorCreateAPI(accountId);
             ApexActionResult result = procInstance.syncRecords();
             if(result.status == ApexActionResult.Statuses.ERROR){
                ApplicationLogger.logException('ProcessorSyncQueueable: Client Sync with Processor', accountId, result.message);
            }
         }catch(Exception ex){
             ApplicationLogger.logException('ProcessorSyncQueueable: Client Sync with Processor', accountId, ex.getMessage());
         }finally{
             ApplicationLogger.insertStoredLogs();
         }
    }
}