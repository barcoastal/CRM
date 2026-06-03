public with sharing class VLPService {    
    
    public static void processOperations(List<Async_Operation__c> operations, Map<Id, Account> acctVLPMap) {
        List<Async_Operation__c> asyncToUpdateList = new List<Async_Operation__c>();
        List<Messaging.SingleEmailMessage> mails = new List<Messaging.SingleEmailMessage>();
        Email_Settings__mdt emailRt = [SELECT Label,DeveloperName,VLP_Recipients__c,Default_From_Address__c FROM Email_Settings__mdt WHERE DeveloperName = 'VLP']; 
        List<String> vlpRecipients = emailRt.VLP_Recipients__c.split(',');         
        String orgwideAddressId = '';
        if(emailRt.Default_From_Address__c != null){
            OrgWideEmailAddress orgEmail = [SELECT Id FROM OrgWideEmailAddress WHERE Address = :emailRt.Default_From_Address__c LIMIT 1];
            orgwideAddressId = orgEmail.Id;
        }     
        
        for (Async_Operation__c op : operations) {
            Async_Operation__c asyncOpToDML = new Async_Operation__c();
            try { 
                Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage(); 
                mail.setOrgWideEmailAddressId(orgwideAddressId);           
                mail.setToAddresses(vlpRecipients);
                mail.setSubject('New Legal Enrollment - '+ acctVLPMap.get(op.Record_Id__c).Primary_Contact__r.Name + ' - '+ acctVLPMap.get(op.Record_Id__c).Name);
                mail.setHtmlBody(generateHTMLBody(acctVLPMap.get(op.Record_Id__c)));         
                mails.add(mail);
                Messaging.sendEmail(mails);
                asyncOpToDML = AsyncOperationUtil.createSuccessAsyncOperationDMLInstance(op.Id, null, null);
            } catch (Exception e) {
                asyncOpToDML = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(op.Id, 'AsyncOpCitadelAPI Failed', null);
            }
            asyncToUpdateList.add(asyncOpToDML);
        }
        
        if(!asyncToUpdateList.isEmpty()){        
        DMLService.performUpdateDML(asyncToUpdateList,'AsyncOpCitadelAPI');
        }
    }
    
    public static String generateHTMLBody(Account acct){
        
        String address = String.isNotBlank(acct.BillingStreet) ? acct.BillingStreet : '';
        address += String.isNotBlank(acct.BillingCity) ? ', '+ acct.BillingCity : ''; 
        address += String.isNotBlank(acct.BillingState) ? ', '+ StateCodeUtil.getUSStateAbbreviation(acct.BillingState) : '';
        address += String.isNotBlank(acct.BillingPostalCode) ? ', '+ acct.BillingPostalCode : '';        
            
        String htmlBody = '<html>'
                + '<body>'               
                + '<table style="border-collapse: collapse; width: 100%;">'                
                + '<tr>'
                + '<td style="padding: 8px; font-weight: bold; width: 200px;">Client Name:</td>'
                + '<td style="padding: 8px;">' + acct.Primary_Contact__r.Name + '</td>'
                + '</tr>'                
                + '<tr>'
                + '<td style="padding: 8px; font-weight: bold;">Business:</td>'
                + '<td style="padding: 8px;">' + acct.Name + '</td>'
                + '</tr>'                
                + '<tr>'
                + '<td style="padding: 8px; font-weight: bold;">Address:</td>'
                + '<td style="padding: 8px;">' + address + '</td>'
                + '</tr>'                
                + '<tr>'
                + '<td style="padding: 8px; font-weight: bold;">Email Address:</td>'
                + '<td style="padding: 8px;">' + acct.Primary_Contact__r.Email + '</td>'
                + '</tr>'                
                + '<tr>'
                + '<td style="padding: 8px; font-weight: bold;">Phone Number:</td>'
                + '<td style="padding: 8px;">' + acct.Primary_Contact__r.Phone + '</td>'
                + '</tr>'                
                + '</table>'                
                + '<br/>'
                + '</body>'
                + '</html>';
                
                return htmlBody;
    }
}