/** A read-only, versioned snapshot of the saved Salesforce contract inputs. */
public with sharing class CoastalESignSnapshot {
    private static String digits(String value) { return value==null ? '' : value.replaceAll('[^0-9]',''); }
    private static Decimal amount(Decimal value, String label) {
        if(value==null) throw new AuraHandledException('Missing Salesforce '+label+'. Recalculate the program before preparing a contract.');
        return value;
    }
    public static Map<String,Object> build(Id recordId, String requestId) {
        if(![SELECT IsSandbox FROM Organization LIMIT 1].IsSandbox || !FeatureManagement.checkPermission('Coastal_ESign_Pilot')) throw new AuraHandledException('Authorized sandbox users only.');
        Opportunity o=[SELECT Id, Email__c, Current_Total_Debt__c, Total_Debt__c, Legal_Network__c, Addendum_Required__c,
            DS_Total_Draft_Amount__c,DS_Total_Retainer_Fee__c,DS_Total_Program_Fee__c,DS_Total_Setup_Fee__c,DS_Total_Service_Fee__c,DS_Total_Processor_Fee__c,DS_Total_Citadel_Fee__c,DS_Total_Escrow_Amount__c,DS_Weekly_Service_Fee__c,
            Account.Name,Account.BillingStreet,Account.BillingCity,Account.BillingState,Account.BillingPostalCode,Account.BillingCountry,Account.BillingCounty__c,
            Account.Bank_Name__c,Account.Bank_Routing_Number__c,Account.Bank_Account_Number__c,Account.Bank_Account_Type__c,Account.EIN_Number_Tax_Id__c,Account.SSN__c,
            Account.Primary_Contact__r.Name,Account.Primary_Contact__r.FirstName,Account.Primary_Contact__r.LastName,Account.Primary_Contact__r.Email,Account.Primary_Contact__r.Phone,Account.Primary_Contact__r.Title,Account.Primary_Contact__r.Birthdate
            FROM Opportunity WHERE Id=:recordId WITH USER_MODE];
        Contact contact=o.Account.Primary_Contact__r;
        if(contact==null) throw new AuraHandledException('Add the primary contact before preparing the contract.');
        if(String.isBlank(contact.Email) || !contact.Email.equalsIgnoreCase(o.Email__c)) throw new AuraHandledException('Primary contact and Opportunity signer emails must match.');
        if(o.Total_Debt__c!=o.Current_Total_Debt__c) throw new AuraHandledException('Current debt and included debt differ. Recalculate the program.');
        List<Program_Plan__c> plans=[SELECT Id,Payment_Processor__r.Processor_Type__c,Payment_Term__c,Payment_Frequency__c,First_Payment_Date__c,Settlement_Percentage__c,Program_Fee_Percentage__c,Retainer_Percentage__c,Total_Debt__c FROM Program_Plan__c WHERE Opportunity__c=:recordId WITH USER_MODE LIMIT 2];
        if(plans.size()!=1) throw new AuraHandledException('Exactly one saved program plan is required.');
        Program_Plan__c p=plans[0];
        if(p.Total_Debt__c!=o.Total_Debt__c) throw new AuraHandledException('Saved plan debt differs from enrolled debt. Recalculate the program.');
        List<Object> debts=new List<Object>();
        for(Debt_Details__c d:[SELECT Current_Creditor__r.Name,Creditor_Name__c,Debt_Amount__c,Account_Number__c FROM Debt_Details__c WHERE Opportunity__c=:recordId AND Include_in_the_Program__c=true WITH USER_MODE ORDER BY CreatedDate,Id]) {
            debts.add(new Map<String,Object>{'creditor'=>d.Current_Creditor__r==null?d.Creditor_Name__c:d.Current_Creditor__r.Name,'balance'=>d.Debt_Amount__c,'accountNumber'=>d.Account_Number__c});
        }
        List<Object> drafts=new List<Object>();
        for(Draft__c d:[SELECT Draft_Date__c,Draft_Total_Amount__c,Draft_Status__c,Retainer_Fee__c,Program_Fee__c,Setup_Fee__c,Service_Fee__c,Processor_Fee__c,Citadel_Fee__c,Draft_Amount__c FROM Draft__c WHERE Program_Plan__c=:p.Id WITH USER_MODE ORDER BY Draft_Date__c,Id]) {
            if(d.Draft_Status__c!='Pending' && d.Draft_Status__c!='Scheduled') throw new AuraHandledException('This pilot supports new plans with Pending or Scheduled drafts only. Rescheduled or processed plans require a separate review.');
            drafts.add(new Map<String,Object>{'date'=>d.Draft_Date__c,'amount'=>d.Draft_Total_Amount__c,'retainer'=>amount(d.Retainer_Fee__c,'retainer fee'),'program'=>amount(d.Program_Fee__c,'program fee'),'setup'=>amount(d.Setup_Fee__c,'setup fee'),'service'=>amount(d.Service_Fee__c,'service fee'),'bank'=>amount(d.Processor_Fee__c,'processor fee'),'legal'=>amount(d.Citadel_Fee__c,'legal fee'),'escrow'=>amount(d.Draft_Amount__c,'escrow amount')});
        }
        List<Object> debits=new List<Object>();
        for(Debit_Schedule__c d:[SELECT Start_Date__c,Deposit_Amount__c,Number_of_Payments__c FROM Debit_Schedule__c WHERE Program_Plan__c=:p.Id WITH USER_MODE ORDER BY Start_Date__c,Id]) debits.add(new Map<String,Object>{'date'=>d.Start_Date__c,'amount'=>d.Deposit_Amount__c,'count'=>d.Number_of_Payments__c});
        String ssn=digits(o.Account.SSN__c),ein=digits(o.Account.EIN_Number_Tax_Id__c);
        // Never substitute a masked SSN for the full SSN/TIN field.
        String taxId=ssn.length()==9?ssn:ein;
        Map<String,Object> contract=new Map<String,Object>{'version'=>2,'legalNetwork'=>o.Legal_Network__c,'county'=>o.Account.BillingCounty__c,'phone'=>contact.Phone,'firstName'=>contact.FirstName,'lastName'=>contact.LastName,'title'=>contact.Title==null?'':contact.Title,'birthdate'=>contact.Birthdate,'taxId'=>taxId,'ein'=>ein,
            'bank'=>new Map<String,Object>{'name'=>o.Account.Bank_Name__c,'routing'=>digits(o.Account.Bank_Routing_Number__c),'account'=>digits(o.Account.Bank_Account_Number__c),'type'=>o.Account.Bank_Account_Type__c},
            'plan'=>new Map<String,Object>{'id'=>p.Id,'termMonths'=>String.isBlank(p.Payment_Term__c)?null:Decimal.valueOf(p.Payment_Term__c),'frequency'=>p.Payment_Frequency__c,'firstPaymentDate'=>p.First_Payment_Date__c,'settlementPercent'=>String.isBlank(p.Settlement_Percentage__c)?null:Decimal.valueOf(p.Settlement_Percentage__c),'programFeePercent'=>String.isBlank(p.Program_Fee_Percentage__c)?null:Decimal.valueOf(p.Program_Fee_Percentage__c),'retainerPercent'=>String.isBlank(p.Retainer_Percentage__c)?null:Decimal.valueOf(p.Retainer_Percentage__c),'weeklyServiceFee'=>o.DS_Weekly_Service_Fee__c,'totalDebt'=>o.Total_Debt__c,'totalDraft'=>o.DS_Total_Draft_Amount__c,'totalRetainer'=>o.DS_Total_Retainer_Fee__c,'totalProgram'=>o.DS_Total_Program_Fee__c,'totalSetup'=>o.DS_Total_Setup_Fee__c,'totalService'=>o.DS_Total_Service_Fee__c,'totalBank'=>o.DS_Total_Processor_Fee__c,'totalLegal'=>o.DS_Total_Citadel_Fee__c,'totalEscrow'=>o.DS_Total_Escrow_Amount__c},'debts'=>debts,'drafts'=>drafts,'debitSchedule'=>debits};
        return new Map<String,Object>{'opportunityId'=>recordId,'requestId'=>requestId,'salesforceUserId'=>UserInfo.getUserId(),'accountName'=>o.Account.Name,'signerName'=>contact.Name,'signerEmail'=>o.Email__c,'street'=>o.Account.BillingStreet,'city'=>o.Account.BillingCity,'state'=>o.Account.BillingState,'postalCode'=>o.Account.BillingPostalCode,'country'=>o.Account.BillingCountry,'totalDebt'=>o.Current_Total_Debt__c,'processor'=>p.Payment_Processor__r.Processor_Type__c,'includeAddendum'=>o.Addendum_Required__c,'contract'=>contract};
    }
}
