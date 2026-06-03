public class SuppressionListBatch implements Database.Batchable<String>, Database.Stateful {
    private Id contentDocumentId;
    private String parentId;
    public List<String> duplicates = new List<String>();
    public List<String> nonDuplicates = new List<String>();
    private final static String ORG_WIDE_ADDRESSNAME = 'Coastal Debt';

    public SuppressionListBatch(String parentId, Id contentDocumentId) {
        this.parentId = parentId;
        this.contentDocumentId = contentDocumentId;
    }

    public Iterable<String> start(Database.BatchableContext bc) {
        return new SuppressionListIterable(contentDocumentId);
    }

    public void execute(Database.BatchableContext bc, List<String> phoneNumbers) {

        Set<String> leadPhones = new Set<String>();
        for (Lead l : [
            SELECT Formated_Phone__c
            FROM Lead
            WHERE Formated_Phone__c IN :phoneNumbers
        ]) {
            leadPhones.add(l.Formated_Phone__c);
        }
        
         for (String phone : phoneNumbers) {
             if(leadPhones.contains(phone)) {
                 duplicates.add(phone);
             } else {
                  nonDuplicates.add(phone);
             }
        }
    }
   public void finish(Database.BatchableContext bc) {  
       Map<String,  List<String> > resultMap = new Map<String,  List<String> >{
            'duplicates' => duplicates,
            'nonDuplicates' => nonDuplicates
        };
                    
        List<ContentVersion> contentVersionsToInsert = new List<ContentVersion>();
        Map<String, Blob> blobMap = new Map<String, Blob>();
        Map<String, String> labelMap = new Map<String, String>{
            'duplicates' => 'Duplicates',
            'nonDuplicates' => 'NonDuplicateLeads'
        };
                    
        for (String key : labelMap.keySet()) {
            List<String> phoneList = resultMap.get(key);
            if (phoneList == null) continue;
            
            String label = labelMap.get(key);
            String csvContent = 'Phone\n' + String.join(phoneList, '\n') + '\n';
            Blob csvBlob = Blob.valueOf(csvContent);
            
            ContentVersion version = new ContentVersion(
                Title = label + '_' + System.today(),
                PathOnClient = label + '.csv',
                VersionData = csvBlob,
                Description = 'Batch result for Lead Phone Check'
            );
            contentVersionsToInsert.add(version);
            blobMap.put(label, csvBlob);
        }
        
        insert contentVersionsToInsert;
        
        Map<Id, String> versionIdToDocId = new Map<Id, String>();
        for (ContentVersion cv : [
            SELECT Id, ContentDocumentId FROM ContentVersion 
            WHERE Id IN :contentVersionsToInsert
        ]) {
            versionIdToDocId.put(cv.Id, cv.ContentDocumentId);
        }
        
        List<ContentDocumentLink> links = new List<ContentDocumentLink>();
        for (ContentVersion v : contentVersionsToInsert) {
            if (versionIdToDocId.containsKey(v.Id)) {
                links.add(new ContentDocumentLink(
                    ContentDocumentId = versionIdToDocId.get(v.Id),
                    LinkedEntityId = parentId,
                    ShareType = 'I',
                    Visibility = 'AllUsers'
                ));
            }
        }
        insert links;
       
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setOrgWideEmailAddressId(getOrgWideEmailAddressId());

        List<String> toAddresses = new List<String>();
       
        toAddresses.addAll(getContactEmails(parentId));
        toAddresses.addAll(getGroupEmails(System.Label.Suppression_List_Group));
       
        email.setToAddresses(toAddresses);
        email.setSubject('Duplicates & Non-Duplicates Report');
        email.setPlainTextBody(getEmailBody(resultMap));
        List<Messaging.EmailFileAttachment> attachments = generateAttachments(labelMap, blobMap);
        email.setFileAttachments(attachments);

        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { email });
    }
    private static Id getOrgWideEmailAddressId() {
        List<OrgWideEmailAddress> owea = [SELECT Id FROM OrgWideEmailAddress WHERE DisplayName =:ORG_WIDE_ADDRESSNAME LIMIT 1];
        return owea.isEmpty() ? null : owea[0].Id;
    }
    
    private static List<Messaging.EmailFileAttachment> generateAttachments(Map<String, String> labelMap, Map<String, Blob> blobMap) {
        List<Messaging.EmailFileAttachment> attachments = new List<Messaging.EmailFileAttachment>();
        for (String label : labelMap.values()) {
            Blob blobContent = blobMap.get(label);
            if (blobContent != null) {
                Messaging.EmailFileAttachment attachment = new Messaging.EmailFileAttachment();
                attachment.setFileName(label + '.csv');
                attachment.setBody(blobContent);
                attachment.setContentType('text/csv');
                attachments.add(attachment);
            }
        }
        return attachments;
    }

    private static List<String> getContactEmails(Id parentId) {
        List<String> emails = new List<String>();
        for (Contact c : [SELECT Email FROM Contact WHERE AccountId = :parentId AND Email != null]) {
            emails.add(c.Email);
        }
        return emails;
    }

    private static List<String> getGroupEmails(String groupName) {
        Set<Id> groupIds = new Set<Id>();
        for (Group g : [SELECT Id FROM Group WHERE Name = :groupName]) {
            groupIds.add(g.Id);
        }

        Set<Id> userIds = new Set<Id>();
        for (GroupMember gm : [SELECT UserOrGroupId FROM GroupMember WHERE GroupId IN :groupIds]) {
            userIds.add(gm.UserOrGroupId);
        } 

        List<String> emails = new List<String>();
        for (User u : [SELECT Email FROM User WHERE Id IN :userIds AND Email != null]) {
            emails.add(u.Email);
        }
        return emails;
    }

    private static String getEmailBody(Map<String, List<String>> resultMap) {
        return 'Hi,\n\nThe file upload has completed successfully.\n\n'
            + 'Here is a summary of the results:\n'
            + '- Total Duplicates: ' + resultMap.get('duplicates').size() + '\n'
            + '- Total Non-Duplicates: ' + resultMap.get('nonDuplicates').size() + '\n\n'
            + 'CSV reports are attached.\n\nRegards,';
    }
 	public class SuppressionWrapper {
        public String phone;
        public Boolean isDuplicate;

        public SuppressionWrapper(String phone, Boolean isDuplicate) {
            this.phone = phone;
            this.isDuplicate = isDuplicate;
        }
    }

}