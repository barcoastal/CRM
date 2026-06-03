public without sharing class Batch_RAM_GetEscrowBalance implements Database.Batchable<GetBalancesWrapper>, Database.AllowsCallouts, Database.Stateful,Schedulable  {
    
    public String query;
    public Integer batchSize = 5;
    public String fromDate;
    
    //Date format should be yyy-MM-dd
    public Batch_RAM_GetEscrowBalance (String fromDate, Integer batchSize) {
        this.fromDate = fromDate;
        if (batchSize != null && batchSize > 0) {
            this.batchSize = batchSize;
        }
    }
    
    public Batch_RAM_GetEscrowBalance(){
        this.fromDate = Datetime.now().addDays(-1).format('yyyy-MM-dd');
    }   
    
    public Iterable<GetBalancesWrapper> start(Database.BatchableContext bc){ 
        List<GetBalancesWrapper> getBalanceWrap = new List<GetBalancesWrapper>();       
        try{            
            ProcessorWrapper.API_Response customerResponse = RAMApi.getUpdatedSavingDetails(this.fromDate);
            if(customerResponse.isSuccess == true && customerResponse.processData != null){
                getBalanceWrap = (List<GetBalancesWrapper>)JSON.deserialize(customerResponse.processData, List<GetBalancesWrapper>.class);            
            }else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(customerResponse.message) ? customerResponse.message : 'No Data found.', null);  
            }            
        }catch (Exception exp) {
            ApplicationLogger.logException('Batch_RAM_GetEscrowBalance', null, exp.getMessage());
        }
        return getBalanceWrap;
    } 
    
    public void execute(Database.BatchableContext bc, List<GetBalancesWrapper> scope) {
        List<Account> updateAccount = new List<Account>(); 
        Set<String> accExternalIds = new Set<String>(); 
        Map<String, Decimal> balanceMap = new Map<String, Decimal>();          
        try {
            for(GetBalancesWrapper rec: scope){
                accExternalIds.add(rec.externalId);
                balanceMap.put(rec.externalId, rec.balance);
            } 
            for(Account acc: [SELECT Id, External_RAM_Id__c,Escrow_Balance__c, Escrow_Balance_Pulled_Date_Time__c FROM Account WHERE External_RAM_Id__c IN :accExternalIds]){
                acc.Escrow_Balance__c = balanceMap.containskey(acc.External_RAM_Id__c) ? balanceMap.get(acc.External_RAM_Id__c) : acc.Escrow_Balance__c;
                acc.Escrow_Balance_Pulled_Date_Time__c = System.now(); 
                updateAccount.add(acc);
            }   
        
            for (Database.UpsertResult acctInst: Database.upsert(updateAccount, false)) {
                if (!acctInst.isSuccess()) {           
                    for (Database.Error err : acctInst.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'Account fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            acctInst.getId(), err.getStatuscode() + ': ' + err.getMessage(), true
                        );
                    }
                }
            }
        }catch (Exception exp) {
            ApplicationLogger.logException('Batch_RAM_GetEscrowBalance', null, exp.getMessage());
        }finally {
            ApplicationLogger.insertStoredLogs();
        }
    }
    
    public void finish(Database.BatchableContext bc) {
    }
    
    public void execute(SchedulableContext sc) {
        Database.executeBatch(new Batch_RAM_GetEscrowBalance(), this.batchSize);
    }
        
     public class GetBalancesWrapper {
        public String externalId;
        public Decimal balance;
    }
}