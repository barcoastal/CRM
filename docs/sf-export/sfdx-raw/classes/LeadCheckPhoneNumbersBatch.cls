public class LeadCheckPhoneNumbersBatch implements Database.Batchable<SObject>, Database.Stateful {
    private Id contentVersionId;
    private Id contentDocumentId;
    private String parentId;
    List<String> phoneNumbers = new List<String>();
    
    public Map<String, List<String>> resultMap = new Map<String, List<String>>{
        'duplicates' => new List<String>(),
        'nonDuplicates' => new List<String>()
    };

    public LeadCheckPhoneNumbersBatch(String parentId, Id contentDocumentId) {
        this.parentId = parentId;
        this.contentDocumentId = contentDocumentId;
    }

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Title, VersionData
            FROM ContentVersion
            WHERE ContentDocumentId = :contentDocumentId
            ORDER BY CreatedDate DESC
            LIMIT 1
        ]);
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        Set<String> phoneNumbers = new Set<String>();

        for (SObject s : scope) {
            ContentVersion cv = (ContentVersion)s;
            Blob fileBody = cv.VersionData;
            String fileContent = fileBody.toString();

            List<String> lines = new List<String>();
            Integer start = 0;
            Integer next = fileContent.indexOf('\n');

            while (next != -1) {
                lines.add(fileContent.substring(start, next));
                start = next + 1;
                next = fileContent.indexOf('\n', start);
            }

            if (start < fileContent.length()) {
                lines.add(fileContent.substring(start));
            }

            for (Integer i = 1; i < lines.size(); i++) {
                String line = lines[i].trim();
                if (String.isNotBlank(line)) {
                    Integer commaIndex = line.indexOf(',');
                    String phone = (commaIndex != -1) ? line.substring(0, commaIndex) : line;
                    if (String.isNotBlank(phone)) {
                        phoneNumbers.add(phone.trim());
                    }
                }
            }
        }




        Map<String, Lead> leadMap = new Map<String, Lead>();
        for (Lead l : [
            SELECT Id, Formated_Phone__c
            FROM Lead
            WHERE Formated_Phone__c IN :phoneNumbers
        ]) {
            if (String.isNotBlank(l.Formated_Phone__c)) {
                leadMap.put(l.Formated_Phone__c.trim(), l);
            }
        }

        for (String phone : phoneNumbers) {
            if (leadMap.containsKey(phone)) {
                resultMap.get('duplicates').add(phone);
            } else {
                resultMap.get('nonDuplicates').add(phone);
            }
        }
    }

    /*public void finish(Database.BatchableContext bc) {
        String jobId = bc.getJobId();

        String dupCsvContent = 'Phone\n';
        for (String dup : resultMap.get('duplicates')) {
            dupCsvContent += dup + '\n';
        }

        Blob dupBlob = Blob.valueOf(dupCsvContent);
        ContentVersion dupVersion = new ContentVersion(
            Title = 'Duplicates_' + System.today(),
            PathOnClient = 'Duplicates.csv',
            VersionData = dupBlob,
            Description = 'Batch result for Lead Phone Check'
        );
        insert dupVersion;

        dupVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :dupVersion.Id LIMIT 1];

        insert new ContentDocumentLink(
            ContentDocumentId = dupVersion.ContentDocumentId,
            LinkedEntityId = parentId,
            ShareType = 'I',
            Visibility = 'AllUsers'
        );

        String nonDupCsvContent = 'Phone\n';
        for (String nonDup : resultMap.get('nonDuplicates')) {
            nonDupCsvContent += nonDup + '\n';
        }

        Blob nonDupBlob = Blob.valueOf(nonDupCsvContent);
        ContentVersion nonDupVersion = new ContentVersion(
            Title = 'NonDuplicateLeads_' + System.today(),
            PathOnClient = 'NonDuplicates.csv',
            VersionData = nonDupBlob,
            Description = 'Batch result for Lead Phone Check'
        );
        insert nonDupVersion;

        nonDupVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :nonDupVersion.Id LIMIT 1];

        insert new ContentDocumentLink(
            ContentDocumentId = nonDupVersion.ContentDocumentId,
            LinkedEntityId = parentId,
            ShareType = 'I',
            Visibility = 'AllUsers'
        );

        Messaging.EmailFileAttachment dupAttachment = new Messaging.EmailFileAttachment();
        dupAttachment.setFileName('Duplicates.csv');
        dupAttachment.setBody(dupBlob);
        dupAttachment.setContentType('text/csv');

        Messaging.EmailFileAttachment nonDupAttachment = new Messaging.EmailFileAttachment();
        nonDupAttachment.setFileName('NonDuplicates.csv');
        nonDupAttachment.setBody(nonDupBlob);
        nonDupAttachment.setContentType('text/csv');

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        OrgWideEmailAddress[] owea = [SELECT Id FROM OrgWideEmailAddress LIMIT 1];
        if (!owea.isEmpty()) {
            email.setOrgWideEmailAddressId(owea[0].Id);
        }

        email.setToAddresses(new String[] { 'vigneshwaran@yatitechnology.com' });
        email.setSubject('Batch Job Finished: Duplicates & Non-Duplicates Report');
        email.setPlainTextBody('Hi,\n\nThe file upload has completed successfully.\n\n'
            + 'Here is a summary of the results:\n'
            + '- Total Duplicates: ' + resultMap.get('duplicates').size() + '\n'
            + '- Total Non-Duplicates: ' + resultMap.get('nonDuplicates').size() + '\n\n'
            + 'CSV reports are attached.\n\nRegards,');

        email.setFileAttachments(new Messaging.EmailFileAttachment[] { dupAttachment, nonDupAttachment });
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { email });
    }*/


    public void finish(Database.BatchableContext bc) {
    String jobId = bc.getJobId();

    List<ContentVersion> contentVersionsToInsert = new List<ContentVersion>();
    Map<String, Blob> blobMap = new Map<String, Blob>();
    Map<String, String> labelMap = new Map<String, String>{
        'duplicates' => 'Duplicates',
        'nonDuplicates' => 'NonDuplicateLeads'
    };

    for (String key : new List<String>{'duplicates', 'nonDuplicates'}) {
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

    List<Messaging.EmailFileAttachment> attachments = new List<Messaging.EmailFileAttachment>();
    for (String label : labelMap.values()) {
        Blob blobContent = blobMap.get(label);
        if (blobContent != null) {
            Messaging.EmailFileAttachment dupAttachment = new Messaging.EmailFileAttachment();
            dupAttachment.setFileName(label + '.csv');
            dupAttachment.setBody(blobContent);
            dupAttachment.setContentType('text/csv');
            attachments.add(dupAttachment);
        }
    }

    Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
    OrgWideEmailAddress[] owea = [SELECT Id FROM OrgWideEmailAddress LIMIT 1];
    if (!owea.isEmpty()) {
        email.setOrgWideEmailAddressId(owea[0].Id);
    }

    List<String> contactEmails = new List<String>();
    for (Contact c : [SELECT Email FROM Contact WHERE AccountId = :parentId AND Email != null]) {
        contactEmails.add(c.Email);
    }

    Set<Id> groupIds = new Set<Id>();
	String groupName = System.Label.Suppression_List_Group;
    for (Group g : [SELECT Id FROM Group WHERE Name IN (:groupName)]) {
        groupIds.add(g.Id);
    }

    Set<Id> userIds = new Set<Id>();
    for (GroupMember gm : [SELECT UserOrGroupId FROM GroupMember WHERE GroupId IN :groupIds]) {
        userIds.add(gm.UserOrGroupId);
    }

    List<String> groupEmails = new List<String>();
    for (User u : [SELECT Email FROM User WHERE Id IN :userIds AND Email != null]) {
        groupEmails.add(u.Email);
    }

    List<String> toAddresses = new List<String>();
    toAddresses.addAll(contactEmails);
    toAddresses.addAll(groupEmails);
    if(Test.isRunningTest()) {
           toAddresses.add('test@gmail.com');  
    }

    email.setToAddresses(toAddresses);
    email.setSubject('Batch Job Finished: Duplicates & Non-Duplicates Report');
    email.setPlainTextBody('Hi,\n\nThe file upload has completed successfully.\n\n'
        + 'Here is a summary of the results:\n'
        + '- Total Duplicates: ' + resultMap.get('duplicates').size() + '\n'
        + '- Total Non-Duplicates: ' + resultMap.get('nonDuplicates').size() + '\n\n'
        + 'CSV reports are attached.\n\nRegards,');
    email.setFileAttachments(attachments);

    Messaging.sendEmail(new Messaging.SingleEmailMessage[] { email });
}

}