public without sharing class EmailService Implements Messaging.InboundEmailHandler {
        
    public Messaging.InboundEmailResult handleInboundEmail(Messaging.InboundEmail email, Messaging.InboundEnvelope envelope) {
        if (email != null) {
            if (email.messageId != null && email.fromAddress != null) {
                EmailMessage msg = new EmailMessage();
                if (email.ccAddresses != null && !email.ccAddresses.isEmpty()) {
                    msg.CcAddress = email.ccAddresses[0];
                }
                msg.FromAddress = email.fromAddress;
                if (email.toAddresses != null && !email.toAddresses.isEmpty()) {
                    msg.ToAddress = email.toAddresses[0];
                }
                msg.HtmlBody = email.htmlBody;
                msg.TextBody = email.plainTextBody;
                msg.Subject = email.Subject;
                msg.Incoming = true;
                msg.Status = '3';                
                insert msg;

                Id relationId;
                if (email.fromAddress != null) {
                    List<Account> accounts = [SELECT Id, PersonContactId FROM Account WHERE PersonEmail = :email.fromAddress ORDER BY CreatedDate DESC LIMIT 1];
                    if (accounts != null && !accounts.isEmpty()) {
                        relationId = accounts[0].PersonContactId;
                    }
                    if (relationId == null) {
                        List<Contact> contacts = [SELECT Id FROM Contact WHERE Email = :email.fromAddress ORDER BY CreatedDate DESC LIMIT 1];
                        if (contacts != null && !contacts.isEmpty()) {
                            relationId = contacts[0].Id;
                        }
                    }
                    if (relationId == null) {
                        List<Lead> leads = [SELECT Id FROM Lead WHERE Email = :email.fromAddress ORDER BY CreatedDate DESC LIMIT 1];
                        if (leads != null && !leads.isEmpty()) {
                            relationId = (leads[0].Id);
                        }
                    }
                }
                
                if (relationId != null) {
                    EmailMessageRelation relation = new EmailMessageRelation();
                    relation.EmailMessageId = msg.Id;
                    relation.RelationId = relationId;
                    relation.RelationType = 'FromAddress';
                    insert relation;
                }
            }
        }
        return null;
    }
}