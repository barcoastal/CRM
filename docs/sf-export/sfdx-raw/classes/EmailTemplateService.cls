public with sharing class EmailTemplateService {
    
    public class EmailRequest {
        public List<String> recipientEmail;
        public String subject;
        public String htmlBody;
        public String plainTextBody;
        public Map<String, String> mergeFields;
        public List<String> ccEmails;

        public EmailRequest(List<String> recipientEmail, String subject, String body, Boolean isHtml,Map<String, String> mergeField) {
            this.recipientEmail = recipientEmail;
            this.subject = subject;
            if (isHtml) {
                this.htmlBody = body;
            } else {
                this.plainTextBody = body;
            }
            this.mergeFields = mergeField;
            this.ccEmails = new List<String>();
        }
    }

    public static void sendEmail(EmailRequest request) {
     
        Messaging.SingleEmailMessage email = createEmailMessage(request);
        try {
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
            System.debug('Email sent to: ' + request.recipientEmail);
        } catch (Exception e) {
            System.debug('Email send failed: ' + e.getMessage());
        }
    }

    public static void sendBulkEmails(List<EmailRequest> requests) {
        List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();

        for (EmailRequest request : requests) {
            if (request.recipientEmail.size() > 0) {
                emails.add(createEmailMessage(request));
            }
        }

        if (!emails.isEmpty()) {
            try {
                Messaging.sendEmail(emails);
                System.debug('Bulk emails sent successfully.');
            } catch (Exception e) {
                System.debug('Bulk email send failed: ' + e.getMessage());
            }
        }
    }

    private static Messaging.SingleEmailMessage createEmailMessage(EmailRequest request) {
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(request.recipientEmail);
        email.setSubject(request.subject);

        if (!String.isEmpty(request.htmlBody)) {
            
            email.setHtmlBody(applyMergeFields(request.htmlBody, request.mergeFields));
        } else {
            email.setPlainTextBody(applyMergeFields(request.plainTextBody, request.mergeFields));
        }

        if (!request.ccEmails.isEmpty()) {
            email.setCcAddresses(request.ccEmails);
        }
        
        return email;
    }

    private static String applyMergeFields(String template, Map<String, String> mergeFields) {
        if (String.isEmpty(template) || mergeFields == null || mergeFields.isEmpty()) {
            return template;
        }

        for (String key : mergeFields.keySet()) {
            template = template.replace('{{{' + key + '}}}', mergeFields.get(key));
        }
        return template;
    }
     public static EmailTemplate getEmailTemplateByName(String templateName) {
        if (String.isEmpty(templateName)) {
            System.debug('Template name is required.');
            return null;
        }
        
        EmailTemplate template = [
            SELECT Id, Name, Subject, HtmlValue, Body 
            FROM EmailTemplate 
            WHERE Name = :templateName
            LIMIT 1
        ];
        
        return template;
    }
    public static List<Id> getUserIdsFromGroups() {
        List<Group> groups = [SELECT Id FROM Group WHERE Name IN ('Affiliate Group', 'Internal Buyout Admin Group')];        
        if (groups.isEmpty()) {
            return new List<Id>();
        }

        List<Id> userIds = new List<Id>();
        for (GroupMember gm : [SELECT UserOrGroupId FROM GroupMember WHERE GroupId IN :groups]) {
            userIds.add(gm.UserOrGroupId);
        }
        return userIds;
    }

    public static List<String> getUserEmailsFromGroups() {
        List<Id> userIds = getUserIdsFromGroups();        
        if (userIds.isEmpty()) {
            return new List<String>();
        }

        List<String> userEmails = new List<String>();
        for (User u : [SELECT Email FROM User WHERE Id IN :userIds]) {
            if (!String.isEmpty(u.Email)) {
                userEmails.add(u.Email);
            }
        }
        return userEmails;
    }
    
    @InvocableMethod(label = 'Get Affiliate Group Email')
    public static List<Results> getAffiliateUserEmailsFromGroups() {
        List<Id> userIds = new List<Id>(); 
        List<String> userEmails = new List<String>();       
        List<Group> groups = [SELECT Id FROM Group WHERE Name IN ('Affiliate Group', 'Internal Buyout Admin Group')];
                
        for (GroupMember gm : [SELECT UserOrGroupId FROM GroupMember WHERE GroupId IN :groups]) {
            userIds.add(gm.UserOrGroupId);
        }        
        for (User u : [SELECT Email FROM User WHERE Id IN :userIds]) {
            if (!String.isEmpty(u.Email)) {
                userEmails.add(u.Email);
            }
        }
        Results response = new Results();
        response.Email = userEmails;
       
        List<Results> responseWrapper= new List<Results>();
        responseWrapper.add(response);
        return responseWrapper;    
    }
    
    public class Results {
        @InvocableVariable(label='Email List')
      public List<String> Email;
    }
}