<?php

function scoop_bundle_specs(): array {
  return [
    'Cabinet'   => ['needs' => ['cabinet','slot','flavor']],
    'FlavorTub' => ['needs' => ['tub','flavor','use']],
    'Batch'     => ['needs' => ['flavor']],
    'Closeout'  => ['needs' => ['flavor','use']],
  ];
}

function scoop_get_entity_spec_keys(string $bundle_key): array {
  return scoop_bundle_specs()[$bundle_key]['needs'];
}

function scoop_entity_specs(string $key = ''): array {
  $spc =[
    'tub' => [
      'post_type' => 'tub',
      'pod'       => 'tub',
      'title'     => true, // TODO: Remove... not shown, but JS might try to use...
      'fields'    => [
          'state'  => 'string',
          'use'    => 'int',
          'amount' => 'float',
          'flavor' => 'int',
          'date'   => 'string',
          'location'=> 'int',
          'index'  => 'int',
      ],
      'post_fields' => [
          'author_name' => 'string',     // comes from WP_Post->post_author
      ],
      'filter' => function(array $row, array $ctx) {
          return ($row['state'] ?? '') !== 'Emptied';
      },
      'writeable' => ['state','use','amount']
    ],

    'slot' => [
      'post_type' => 'slot',
      'pod'       => 'slot',
      'title'     => true,
      'fields'    => [
        'cabinet'          => 'int',
        'location'         => 'int',
        'current_flavor'   => 'int',
        'immediate_flavor' => 'int',
        'next_flavor'      => 'int',
      ],
      'writeable' => ['current_flavor','immediate_flavor','next_flavor']
    ],

    'cabinet' => [
      'post_type' => 'cabinet',
      'pod'       => 'cabinet',
      'title'     => true,
      'fields'    => [
        'location' => 'int',
        'max_tubs' => 'int',
      ],
      'writeable' => []
    ],

    'flavor' => [
      'post_type' => 'flavor',
      'pod'       => 'flavor',
      'title'     => true,
      'fields'    => [
        // add fields as needed; you can omit tub if you’ll compute from tub list
      ],
      'writeable' => []
    ],

    'use' => [
      'post_type' => 'use',
      'pod'       => 'use',
      'title'     => true,
      'fields'    => [
        'order' => 'int',
      ],
      'writeable' => []
    ],

    'location' => [
      'post_type' => 'location',
      'pod'       => 'location',
      'title'     => true,
      'fields'    => [
        // none needed for now
      ],
      'writeable' => []
    ],
  ];
  if( $key === '') return $spc;
  return $spc[$key];
}
