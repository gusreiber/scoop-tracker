<?php
// Add to _pods_helpers.php (or create new _access.php file)

function scoop_access_policy(): array {
  return [
    '_default' => [
      'routes' => [
        'Cabinet'   => ['GET' => true, 'POST' => true],
        'FlavorTub' => ['GET' => true, 'POST' => true],
        'Batch'     => ['GET' => true, 'POST' => true],
        'Closeout'  => ['GET' => true, 'POST' => true],
      ],
      'entities' => [
        'tub'  => ['state','use','amount'],
        'slot' => ['current_flavor','immediate_flavor','next_flavor'],
      ],
    ],

    'author' => [
      'routes' => [
        'Cabinet'   => ['GET' => true, 'POST' => false],
        'FlavorTub' => ['GET' => true, 'POST' => false],
        'Batch'     => ['GET' => true, 'POST' => true],
        'Closeout'  => ['GET' => true, 'POST' => false],
      ],
      'entities' => [
        'tub'  => [],
        'slot' => [],
      ],
    ],

    'editor' => [
      'routes' => [
        'Cabinet'   => ['GET' => true, 'POST' => true],
        'FlavorTub' => ['GET' => true, 'POST' => true],
        'Batch'     => ['GET' => true, 'POST' => true],
        'Closeout'  => ['GET' => true, 'POST' => true],
      ],
      'entities' => [
        'tub'  => ['state'],
        'slot' => ['current_flavor'],
      ],
    ],
  ];
}
function scoop_get_user_policy(\WP_User $user): array {
  $policy = scoop_access_policy();
  
  error_log("scoop_get_user_policy called for user: " . $user->user_login);
  error_log("User roles: " . print_r($user->roles, true));
  
  // Check roles in priority order
  if (in_array('administrator', $user->roles)) {
    error_log("User is administrator - using _default policy");
    return $policy['_default'];
  }
  
  if (in_array('editor', $user->roles)) {
    error_log("User is editor - using editor policy");
    return $policy['editor'];
  }
  
  if (in_array('author', $user->roles)) {
    error_log("User is author - using author policy");
    return $policy['author'];
  }
  
  // Default policy
  error_log("User has no matching role - using _default policy");
  return $policy['_default'];
}

function scoop_user_writeable_fields(\WP_User $user, string $entity): array {
  $policy = scoop_get_user_policy($user);
  $fields = $policy['entities'][$entity] ?? [];
  
  error_log("scoop_user_writeable_fields($entity) for " . $user->user_login . ": " . print_r($fields, true));
  
  return $fields;
}

function scoop_user_can_route(\WP_User $user, string $route, string $method): bool {
  $policy = scoop_get_user_policy($user);
  return $policy['routes'][$route][$method] ?? false;
}