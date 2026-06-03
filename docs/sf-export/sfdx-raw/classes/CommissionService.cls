public inherited sharing class CommissionService {
    
    private static List<Commission_Tier_Structure__c> tierStructure;

    public static List<Commission_Tier_Structure__c> getTiers() {
        if (tierStructure == null) {
            tierStructure = CommissionTierData.getActiveTiers();
        }
        return tierStructure;
    }

    public static void calculateTier(List<SObject> records, String amountField) {
        try {
            
        List<Commission_Tier_Structure__c> tiers = getTiers();

        Commission_Tier_Structure__c highestTier = tiers[tiers.size() - 1];

        for (SObject record : records) {
            Decimal amount = (Decimal)record.get(amountField);
            if (amount == null) amount = 0;
            
            Boolean tierFound = false;

            for (Commission_Tier_Structure__c tier : tiers) {
                Decimal max = tier.Maximum_Total_Debt_Amount__c;
                
                if (amount >= tier.Minimum_Total_Debt_Amount__c && amount <= max) {
                    record.put('Tier__c', tier.Tier_Name__c);
                    record.put('Commission_Rate__c', tier.Commission_Rate__c);
                    break;
                }
            }

            if (!tierFound && amount > highestTier.Maximum_Total_Debt_Amount__c) {
                record.put('Tier__c', highestTier.Tier_Name__c);
                record.put('Commission_Rate__c', highestTier.Commission_Rate__c);
            }
        }
        } catch (Exception ex) {
           ApplicationLogger.logExceptionWithData(ex, null, 'Commission Structure Error',null, ApplicationLogger.SEVERITY_HIGH);
        }
     }
}