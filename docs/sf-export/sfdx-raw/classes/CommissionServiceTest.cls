@isTest
public class CommissionServiceTest {

    @testSetup
    static void setup() {
        List<Commission_Tier_Structure__c> tiers = new List<Commission_Tier_Structure__c>();
        tiers.add(new Commission_Tier_Structure__c(Tier_Name__c='Tier 1', Minimum_Total_Debt_Amount__c=0, Maximum_Total_Debt_Amount__c=1000, Commission_Rate__c=10, Active__c=true));
        tiers.add(new Commission_Tier_Structure__c(Tier_Name__c='Tier 2', Minimum_Total_Debt_Amount__c=1001, Maximum_Total_Debt_Amount__c=5000, Commission_Rate__c=15, Active__c=true));
        tiers.add(new Commission_Tier_Structure__c(Tier_Name__c='Tier 3', Minimum_Total_Debt_Amount__c=5001, Maximum_Total_Debt_Amount__c=null, Commission_Rate__c=20, Active__c=true)); 
        insert tiers;
    }

    @isTest
    static void testCalculateTier() {
        List<Agent_Monthly_Tier__c> agentMTList = New List<Agent_Monthly_Tier__c>();
        
        Agent_Monthly_Tier__c agentMTier = New Agent_Monthly_Tier__c();
        agentMTier.Total_Debt_Amount__c = 500;
        agentMTList.add(agentMTier);
        
        Agent_Monthly_Tier__c agentMTier2 = New Agent_Monthly_Tier__c();
        agentMTier2.Total_Debt_Amount__c = 2500;
        agentMTList.add(agentMTier2);
        
        Agent_Monthly_Tier__c agentMTier3 = New Agent_Monthly_Tier__c();
        agentMTier3.Total_Debt_Amount__c = 10000;
        agentMTList.add(agentMTier3);
        
        insert agentMTList;
        
        Test.startTest();
        CommissionService.calculateTier(agentMTList, 'Total_Debt_Amount__c');
        Test.stopTest();
        
        Agent_Monthly_Tier__c agentMonTier1 = [SELECT Id,Total_Debt_Amount__c,Tier__c,Commission_Rate__c FROM Agent_Monthly_Tier__c WHERE Tier__c = 'Tier 1' LIMIT 1];
        
        Agent_Monthly_Tier__c agentMonTier2 = [SELECT Id,Total_Debt_Amount__c,Tier__c,Commission_Rate__c FROM Agent_Monthly_Tier__c WHERE Tier__c = 'Tier 2' LIMIT 1];
        
        
        System.assertEquals('Tier 1', (String)agentMonTier1.get('Tier__c'), 'Tier 1');
        System.assertEquals(10, (Decimal)agentMonTier1.get('Commission_Rate__c'));

        System.assertEquals('Tier 2', (String)agentMonTier2.get('Tier__c'), 'Tier 2');
        System.assertEquals(15, (Decimal)agentMonTier2.get('Commission_Rate__c'));
    }
}