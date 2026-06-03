public class AccountGraduationStatusBatch implements Database.Batchable<SObject> {

    private String query;
    private Set<String> completedStatusSet = new Set<String>{
        'Settled lump sum',
        'Settled payments',
        'Settled PIF'
    };

    private static final String DEFAULT_QUERY = 'SELECT Id FROM Account WHERE Graduation_Status__c = null';

    public AccountGraduationStatusBatch() {
        this.query = DEFAULT_QUERY;
    }

    public AccountGraduationStatusBatch(String query) {
        this.query = String.isNotBlank(query) ? query : DEFAULT_QUERY;
    }

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) {
        try {
            Set<Id> scopeAccountIds = new Map<Id, Account>(scope).keySet();
    
            Map<Id, List<Debt_Details__c>> accountToDebtsMap = new Map<Id, List<Debt_Details__c>>();
            for (Debt_Details__c debt : [
                SELECT Id, Account__c, Negotiation_Status__c
                FROM Debt_Details__c
                WHERE Account__c IN :scopeAccountIds
                AND Opportunity__r.Active_Opportunity__c = true
                AND Negotiation_Status__c IN :completedStatusSet
            ]) {
                if (!accountToDebtsMap.containsKey(debt.Account__c)) {
                    accountToDebtsMap.put(debt.Account__c, new List<Debt_Details__c>());
                }
                accountToDebtsMap.get(debt.Account__c).add(debt);
            }
    
            List<Account> accountsToUpdate = new List<Account>();
            for (Id accId : scopeAccountIds) {
                if (!accountToDebtsMap.containsKey(accId)) continue;
    
                List<Debt_Details__c> allDebts = accountToDebtsMap.get(accId);
                Boolean allSettled = true;
                for (Debt_Details__c debt : allDebts) {
                    if (!completedStatusSet.contains(debt.Negotiation_Status__c)) {
                        allSettled = false;
                        break;
                    }
                }
    
                Account acc = new Account();
                acc.Id = accId;
                acc.Graduation_Status__c = allSettled
                    ? DebtDetailUtil.STATUS_FULLY_GRADUATED : DebtDetailUtil.STATUS_PARTIALLY_GRADUATED;
                accountsToUpdate.add(acc);
            }
    
            if (accountsToUpdate.isEmpty()) return;
    
            for (Database.SaveResult saveResult : Database.update(accountsToUpdate, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage = '';
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException(
                        'Updating Account Graduation Status failed',
                        saveResult.getId(),
                        errorMessage,
                        true
                    );
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException('AccountGraduationStatusBatch', null, ex.getMessage());
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext bc) {}
}