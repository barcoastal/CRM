public class DebtDetailsToAccountHandler {
    public static void legalStatusAssignment(List<Debt_Details__c> newDebtDetails, Map<Id, Debt_Details__c> oldDebtDetailsMap) {
        List<Account> accountsToUpdate = new List<Account>();
        Set<Id> accountIdSet = new Set<Id>();
        
        for (Debt_Details__c debtDetails : newDebtDetails) {
            if(debtDetails.Account__c != null) {
                accountIdSet.add(debtDetails.Account__c);
            }
        }
        Map<Id, Set<String>> accountLegalStatusMap = new Map<Id, Set<String>>();
        for(Debt_Details__c debt : DebtDetailsData.getDebtDetailsByAccount(accountIdSet)){
            if (debt.Account__c != null) {
                if (!accountLegalStatusMap.containsKey(debt.Account__c)) {
                    accountLegalStatusMap.put(debt.Account__c, new Set<String>());
                }
                if (debt.Legal_Status__c != null) {
                    accountLegalStatusMap.get(debt.Account__c).add(debt.Legal_Status__c);
                }
            }
        }
        
        for(Account acc:AccountData.queryAccounts(accountIdSet)){
             Set<String> legalStatusSet = accountLegalStatusMap.containsKey(acc.Id)
                ? accountLegalStatusMap.get(acc.Id)
                : new Set<String>();
            
            String updatedLegalStatus = String.join(new List<String>(legalStatusSet), ';');
            if (acc.Legal_Status__c != updatedLegalStatus) {
                Account accInstance = new Account(Id = acc.Id, Legal_Status__c = updatedLegalStatus);
                accountsToUpdate.add(accInstance);
            }
        }
        
        if (!accountsToUpdate.isEmpty()) {
            AccountService accountService = new AccountService();
            accountService.updateAccountData(accountsToUpdate);
        }
    }

    public static void negotiationStatusAssignment(List<Debt_Details__c> newDebtDetails, Map<Id, Debt_Details__c> oldDebtDetailsMap) {
        List<Account> accountsToUpdate = new List<Account>();
        Set<Id> accountIdSet = new Set<Id>();
        
        for (Debt_Details__c debtDetails : newDebtDetails) {
            Debt_Details__c oldDebt = oldDebtDetailsMap.get(debtDetails.Id);
            if(debtDetails.Account__c != null &&
                debtDetails.Negotiation_Status__c != oldDebt.Negotiation_Status__c) {
                    accountIdSet.add(debtDetails.Account__c);
                    
            }
        }
        Map<Id, Set<String>> accountNegotiationStatusMap = new Map<Id, Set<String>>();
        for(Debt_Details__c debt : DebtDetailsData.getDebtDetailsByAccount(accountIdSet)){
            if (debt.Account__c != null) {
                if (!accountNegotiationStatusMap.containsKey(debt.Account__c)) {
                    accountNegotiationStatusMap.put(debt.Account__c, new Set<String>());
                }
                if (debt.Negotiation_Status__c != null) {
                    accountNegotiationStatusMap.get(debt.Account__c).add(debt.Negotiation_Status__c);
                }
            }
        }
        
        for(Account acc:AccountData.queryAccounts(accountIdSet)){
             Set<String> negotiationStatusSet = accountNegotiationStatusMap.containsKey(acc.Id)
                ? accountNegotiationStatusMap.get(acc.Id)
                : new Set<String>();
            
            String updatedNegotiationStatus = String.join(new List<String>(negotiationStatusSet), ';');
            if (acc.NegotiationStatus__c != updatedNegotiationStatus) {
                Account accInstance = new Account(Id = acc.Id, NegotiationStatus__c = updatedNegotiationStatus);
                accountsToUpdate.add(accInstance);
            }
        }
        
        if (!accountsToUpdate.isEmpty()) {
            AccountService accountService = new AccountService();
            accountService.updateAccountData(accountsToUpdate);
        }
    }
}