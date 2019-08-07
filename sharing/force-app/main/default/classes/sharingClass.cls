public with sharing class sharingClass {
    
    @AuraEnabled(cacheable=true)
    public static string methodName(String recordId){
        // Get object type from id
        Schema.SObjectType token = recordId.getSObjectType();
        String objName = token.getDescribe().getName();

        // Query sharing records.  Filter by sharing reason
        // get sh
        String queryString = 'SELECT Id FROM ' + objName + '__share WHERE ' + objName + 'Id = :recordId';
        List<SObject> results = Database.query(queryString);
        
        // return records
        return results;
    }

    @AuraEnabled
    public static string m0ethodName(){
        // Save new records
        // Return all records
    }

    static void getSharingRecords() {
        // Query sharing records.  Filter by sharing reason
        // get sh
        String queryString = 'SELECT Id FROM ' + objName + '__share WHERE ' + objName + 'Id = :recordId';
    }
}
